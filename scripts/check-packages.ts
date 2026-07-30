import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type ExportTarget =
  | string
  | null
  | {
      [condition: string]: ExportTarget
    }

interface PackageManifest {
  name: string
  private?: boolean
  type?: string
  main?: string
  module?: string
  types?: string
  bin?: Record<string, string>
  exports?: Record<string, ExportTarget>
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

interface NpmPackResult {
  files: Array<{ path: string }>
}

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const packagesRoot = path.join(repoRoot, 'packages')
const smokeRoot = mkdtempSync(path.join(repoRoot, '.package-smoke-'))
const smokeNodeModules = path.join(smokeRoot, 'node_modules')
const npmCache = path.join(smokeRoot, '.npm-cache')

function run(
  command: string,
  args: string[],
  options: { cwd?: string } = {},
): void {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? smokeRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      CI: 'true',
      NO_UPDATE_NOTIFIER: '1',
    },
  })

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n')
    throw new Error(
      `${command} ${args.join(' ')} failed with exit code ${result.status}.\n${output}`,
    )
  }
}

function collectExportTargets(target: ExportTarget | undefined): string[] {
  if (typeof target === 'string') {
    return [target]
  }

  if (!target || typeof target !== 'object') {
    return []
  }

  return Object.values(target).flatMap(collectExportTargets)
}

function hasExportCondition(
  target: ExportTarget | undefined,
  condition: string,
): boolean {
  if (!target || typeof target !== 'object') {
    return false
  }

  if (condition in target) {
    return true
  }

  return Object.values(target).some(value =>
    hasExportCondition(value, condition),
  )
}

function supportsRequire(packageJson: PackageManifest): boolean {
  const rootExport = getRootExport(packageJson)

  return (
    hasExportCondition(rootExport, 'require') ||
    (rootExport === undefined &&
      packageJson.type !== 'module' &&
      packageJson.main !== undefined)
  )
}

function normalizePackagePath(filePath: string): string {
  return filePath.replace(/^\.\//, '')
}

function copyPackedFiles(
  packageRoot: string,
  packageJson: PackageManifest,
  files: string[],
): void {
  const destinationRoot = path.join(
    smokeNodeModules,
    ...packageJson.name.split('/'),
  )

  for (const file of files) {
    const source = path.join(packageRoot, file)
    const destination = path.join(destinationRoot, file)

    mkdirSync(path.dirname(destination), { recursive: true })
    copyFileSync(source, destination)
    chmodSync(destination, statSync(source).mode)
  }

  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.peerDependencies,
  }

  for (const dependency of Object.keys(dependencies)) {
    if (dependency.startsWith('@eljs/')) {
      continue
    }

    const source = path.join(packageRoot, 'node_modules', dependency)
    if (!existsSync(source)) {
      continue
    }

    const destination = path.join(destinationRoot, 'node_modules', dependency)
    mkdirSync(path.dirname(destination), { recursive: true })
    symlinkSync(source, destination, 'junction')
  }
}

function getRootExport(packageJson: PackageManifest): ExportTarget | undefined {
  return packageJson.exports?.['.']
}

mkdirSync(smokeNodeModules, { recursive: true })

try {
  const packages = readdirSync(packagesRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => {
      const packageRoot = path.join(packagesRoot, entry.name)
      const packageJsonPath = path.join(packageRoot, 'package.json')
      const packageJson = JSON.parse(
        readFileSync(packageJsonPath, 'utf8'),
      ) as PackageManifest

      return { packageRoot, packageJson }
    })
    .filter(({ packageJson }) => !packageJson.private)
    .sort((a, b) => a.packageJson.name.localeCompare(b.packageJson.name))

  for (const { packageRoot, packageJson } of packages) {
    const result = spawnSync(
      'npm',
      ['pack', '--dry-run', '--json', '--ignore-scripts'],
      {
        cwd: packageRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          npm_config_cache: npmCache,
        },
      },
    )

    if (result.status !== 0) {
      throw new Error(
        `npm pack failed for ${packageJson.name}.\n${result.stderr}`,
      )
    }

    const [packResult] = JSON.parse(result.stdout) as NpmPackResult[]
    const packedFiles = new Set(packResult.files.map(file => file.path))
    const requiredFiles = [
      packageJson.main,
      packageJson.module,
      packageJson.types,
      ...Object.values(packageJson.bin || {}),
      ...collectExportTargets(packageJson.exports?.['.']),
    ]
      .filter((file): file is string => Boolean(file))
      .map(normalizePackagePath)

    for (const requiredFile of requiredFiles) {
      if (!packedFiles.has(requiredFile)) {
        throw new Error(
          `${packageJson.name} is missing ${requiredFile} from its published tarball.`,
        )
      }
    }

    copyPackedFiles(packageRoot, packageJson, [...packedFiles])
  }

  for (const { packageJson } of packages) {
    if (supportsRequire(packageJson)) {
      run(process.execPath, [
        '-e',
        `require(${JSON.stringify(packageJson.name)})`,
      ])
    }

    run(process.execPath, [
      '--input-type=module',
      '-e',
      `await import(${JSON.stringify(packageJson.name)})`,
    ])

    for (const binPath of Object.values(packageJson.bin || {})) {
      run(process.execPath, [
        path.join(
          smokeNodeModules,
          ...packageJson.name.split('/'),
          normalizePackagePath(binPath),
        ),
        '--help',
      ])
    }
  }

  const typeImports = packages
    .map(
      ({ packageJson }, index) =>
        `import * as package${index} from ${JSON.stringify(packageJson.name)}\nvoid package${index}`,
    )
    .join('\n')

  const requireTypeImports = packages
    .filter(({ packageJson }) => supportsRequire(packageJson))
    .map(
      ({ packageJson }, index) =>
        `import package${index} = require(${JSON.stringify(packageJson.name)})\nvoid package${index}`,
    )
    .join('\n')

  writeFileSync(path.join(smokeRoot, 'consumer.mts'), `${typeImports}\n`)
  writeFileSync(path.join(smokeRoot, 'consumer.cts'), `${requireTypeImports}\n`)
  writeFileSync(
    path.join(smokeRoot, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          target: 'ES2022',
          strict: true,
          noEmit: true,
          skipLibCheck: false,
        },
        include: ['consumer.mts', 'consumer.cts'],
      },
      null,
      2,
    )}\n`,
  )

  run(process.execPath, [
    path.join(repoRoot, 'node_modules/typescript/bin/tsc'),
    '--project',
    path.join(smokeRoot, 'tsconfig.json'),
  ])

  console.log(
    `Verified runtime, types, CLI, and publish contents for ${packages.length} packages.`,
  )
} finally {
  rmSync(smokeRoot, { recursive: true, force: true })
}
