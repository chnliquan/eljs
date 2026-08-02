import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
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
  version: string
  packageManager?: string
  private?: boolean
  type?: string
  main?: string
  module?: string
  types?: string
  bin?: Record<string, string>
  exports?: Record<string, ExportTarget>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

interface PnpmPackResult {
  name: string
  version: string
  filename: string
  files: Array<{ path: string }>
}

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const packagesRoot = path.join(repoRoot, 'packages')
const smokeRoot = mkdtempSync(path.join(tmpdir(), 'eljs-package-smoke-'))
const smokeNodeModules = path.join(smokeRoot, 'node_modules')
const tarballsRoot = path.join(smokeRoot, 'tarballs')

function run(
  command: string,
  args: string[],
  options: { cwd?: string } = {},
): string {
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

  return result.stdout.trim()
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

function assertNoWorkspaceProtocols(packageJson: PackageManifest): void {
  const dependencyFields = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ] as const

  for (const field of dependencyFields) {
    for (const [dependency, version] of Object.entries(
      packageJson[field] ?? {},
    )) {
      if (version.startsWith('workspace:')) {
        throw new Error(
          `${packageJson.name} still contains ${field}.${dependency}=${version} in its packed manifest.`,
        )
      }
    }
  }
}

function getRootExport(packageJson: PackageManifest): ExportTarget | undefined {
  return packageJson.exports?.['.']
}

/**
 * 展开无需模式匹配即可由消费者直接导入的公开入口
 *
 * @remarks
 * `package.json` 与通配符导出不适合通用运行时烟测，其他入口必须分别验证 ESM、
 * 可用的 CommonJS 条件以及 TypeScript 声明解析
 *
 * @param packageJson - 已安装 tarball 的包清单
 * @returns 包名或完整子路径与对应条件导出目标
 */
function getPublicExportSpecifiers(
  packageJson: PackageManifest,
): Array<{ specifier: string; target: ExportTarget | undefined }> {
  const entries = Object.entries(packageJson.exports ?? {})

  if (entries.length === 0) {
    return [{ specifier: packageJson.name, target: undefined }]
  }

  return entries
    .filter(
      ([subpath]) => subpath !== './package.json' && !subpath.includes('*'),
    )
    .map(([subpath, target]) => ({
      specifier:
        subpath === '.'
          ? packageJson.name
          : `${packageJson.name}/${subpath.replace(/^\.\//, '')}`,
      target,
    }))
}

mkdirSync(tarballsRoot, { recursive: true })

try {
  const rootPackageJson = JSON.parse(
    readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
  ) as PackageManifest
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
  const packedPackages = packages.map(({ packageRoot, packageJson }) => {
    const packResult = JSON.parse(
      run('pnpm', ['pack', '--pack-destination', tarballsRoot, '--json'], {
        cwd: packageRoot,
      }),
    ) as PnpmPackResult
    const packedFiles = new Set(packResult.files.map(file => file.path))
    const requiredFiles = [
      packageJson.main,
      packageJson.module,
      packageJson.types,
      ...Object.values(packageJson.bin || {}),
      ...Object.values(packageJson.exports || {}).flatMap(collectExportTargets),
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

    return { packResult }
  })
  const tarballDependencies = Object.fromEntries(
    packedPackages.map(({ packResult }) => [
      packResult.name,
      `file:${path
        .relative(smokeRoot, packResult.filename)
        .split(path.sep)
        .join('/')}`,
    ]),
  )
  const externalDependencyRoots = new Map<string, string>()

  for (const { packageRoot, packageJson } of packages) {
    for (const name of Object.keys({
      ...packageJson.dependencies,
      ...packageJson.optionalDependencies,
    })) {
      if (tarballDependencies[name] || externalDependencyRoots.has(name)) {
        continue
      }

      externalDependencyRoots.set(
        name,
        path.join(packageRoot, 'node_modules', ...name.split('/')),
      )
    }
  }

  const externalDependencyOverrides = Object.fromEntries(
    [...externalDependencyRoots].map(([name, dependencyRoot]) => {
      if (!existsSync(dependencyRoot)) {
        throw new Error(
          `${name} is not installed in the workspace and cannot be linked into the tarball smoke test.`,
        )
      }

      return [name, `link:${dependencyRoot.split(path.sep).join('/')}`]
    }),
  )
  const toolDependencies = {
    typescript: `link:${path
      .join(repoRoot, 'node_modules/typescript')
      .split(path.sep)
      .join('/')}`,
  }
  const installOverrides = {
    ...externalDependencyOverrides,
    ...toolDependencies,
    ...tarballDependencies,
  }

  writeFileSync(
    path.join(smokeRoot, 'package.json'),
    `${JSON.stringify(
      {
        name: 'eljs-package-smoke',
        private: true,
        type: 'module',
        packageManager: rootPackageJson.packageManager,
        dependencies: {
          ...tarballDependencies,
          ...toolDependencies,
        },
      },
      null,
      2,
    )}\n`,
  )
  writeFileSync(
    path.join(smokeRoot, 'pnpm-workspace.yaml'),
    [
      'packages:',
      "  - '.'",
      'autoInstallPeers: false',
      'overrides:',
      ...Object.entries(installOverrides).map(
        ([name, version]) =>
          `  ${JSON.stringify(name)}: ${JSON.stringify(version)}`,
      ),
      '',
    ].join('\n'),
  )

  run(
    'pnpm',
    ['install', '--offline', '--ignore-scripts', '--no-frozen-lockfile'],
    { cwd: smokeRoot },
  )

  const installedPackages = packedPackages.map(({ packResult }) => {
    const installedRoot = path.join(
      smokeNodeModules,
      ...packResult.name.split('/'),
    )
    const installedPackageJson = JSON.parse(
      readFileSync(path.join(installedRoot, 'package.json'), 'utf8'),
    ) as PackageManifest

    if (
      installedPackageJson.name !== packResult.name ||
      installedPackageJson.version !== packResult.version
    ) {
      throw new Error(
        `${packResult.name} installed manifest does not match its tarball metadata.`,
      )
    }

    assertNoWorkspaceProtocols(installedPackageJson)

    return {
      installedRoot,
      packageJson: installedPackageJson,
    }
  })

  for (const { installedRoot, packageJson } of installedPackages) {
    for (const { specifier, target } of getPublicExportSpecifiers(
      packageJson,
    )) {
      if (
        hasExportCondition(target, 'require') ||
        (specifier === packageJson.name && supportsRequire(packageJson))
      ) {
        run(process.execPath, ['-e', `require(${JSON.stringify(specifier)})`])
      }

      run(process.execPath, [
        '--input-type=module',
        '-e',
        `await import(${JSON.stringify(specifier)})`,
      ])
    }

    for (const binPath of Object.values(packageJson.bin || {})) {
      run(process.execPath, [
        path.join(installedRoot, normalizePackagePath(binPath)),
        '--help',
      ])
    }
  }

  const releaseFixtureRoot = path.join(smokeRoot, 'release-fixture')
  mkdirSync(releaseFixtureRoot, { recursive: true })
  writeFileSync(
    path.join(releaseFixtureRoot, 'package.json'),
    `${JSON.stringify({ name: 'release-fixture', version: '1.0.0' })}\n`,
  )

  run(process.execPath, [
    '--input-type=module',
    '-e',
    [
      "import { ReleaseRunner } from '@eljs/release'",
      'class SmokeRunner extends ReleaseRunner { smokeLoad() { return this.load() } }',
      `const runner = new SmokeRunner({ cwd: ${JSON.stringify(releaseFixtureRoot)} })`,
      'await runner.smokeLoad()',
      "if (runner.state !== 'ready') throw new Error('Release ESM plugins were not fully loaded')",
    ].join(';'),
  ])
  run(process.execPath, [
    '-e',
    [
      "const { ReleaseRunner } = require('@eljs/release')",
      'class SmokeRunner extends ReleaseRunner { smokeLoad() { return this.load() } }',
      `const runner = new SmokeRunner({ cwd: ${JSON.stringify(releaseFixtureRoot)} })`,
      "runner.smokeLoad().then(() => { if (runner.state !== 'ready') throw new Error('Release CJS plugins were not fully loaded') })",
    ].join(';'),
  ])

  const createTemplateRoot = path.join(smokeRoot, 'create-template')
  mkdirSync(createTemplateRoot, { recursive: true })
  writeFileSync(
    path.join(createTemplateRoot, 'package.json'),
    `${JSON.stringify({ name: 'create-template-fixture' })}\n`,
  )
  writeFileSync(
    path.join(createTemplateRoot, 'create.config.js'),
    'module.exports = { defaultQuestions: false, gitInit: false, install: false }\n',
  )

  run(process.execPath, [
    '--input-type=module',
    '-e',
    [
      "import { ProjectCreator } from '@eljs/create'",
      `const creator = new ProjectCreator({ cwd: ${JSON.stringify(smokeRoot)}, template: ${JSON.stringify(createTemplateRoot)} })`,
      "await creator.run('create-esm-output')",
    ].join(';'),
  ])
  run(process.execPath, [
    '-e',
    [
      "const { ProjectCreator } = require('@eljs/create')",
      `const creator = new ProjectCreator({ cwd: ${JSON.stringify(smokeRoot)}, template: ${JSON.stringify(createTemplateRoot)} })`,
      "creator.run('create-cjs-output')",
    ].join(';'),
  ])

  const typeImports = installedPackages
    .flatMap(({ packageJson }) =>
      getPublicExportSpecifiers(packageJson).map(({ specifier }) => specifier),
    )
    .map(
      (specifier, index) =>
        `import * as package${index} from ${JSON.stringify(specifier)}\nvoid package${index}`,
    )
    .join('\n')

  const requireTypeImports = installedPackages
    .flatMap(({ packageJson }) =>
      getPublicExportSpecifiers(packageJson)
        .filter(
          ({ specifier, target }) =>
            hasExportCondition(target, 'require') ||
            (specifier === packageJson.name && supportsRequire(packageJson)),
        )
        .map(({ specifier }) => specifier),
    )
    .map(
      (specifier, index) =>
        `import package${index} = require(${JSON.stringify(specifier)})\nvoid package${index}`,
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
    `Verified real tarball installation, runtime, types, CLI, and publish contents for ${packages.length} packages.`,
  )
} finally {
  rmSync(smokeRoot, { recursive: true, force: true })
}
