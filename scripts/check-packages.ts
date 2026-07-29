import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

interface PackageManifest {
  name: string
  main?: string
  types?: string
  bin?: Record<string, string>
}

interface NpmPackResult {
  files: Array<{ path: string }>
}

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const packageDirectories = [
  'cache',
  'config',
  'conventional-changelog-preset',
  'create',
  'create-template',
  'pluggable',
  'release',
  'utils',
]

const npmCache = mkdtempSync(path.join(tmpdir(), 'eljs-npm-cache-'))

try {
  for (const directory of packageDirectories) {
    const cwd = path.join(repoRoot, 'packages', directory)
    const packageJson = JSON.parse(
      readFileSync(path.join(cwd, 'package.json'), 'utf8'),
    ) as PackageManifest
    const result = spawnSync(
      'npm',
      ['pack', '--dry-run', '--json', '--ignore-scripts'],
      {
        cwd,
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
      packageJson.types,
      ...Object.values(packageJson.bin || {}),
    ].filter((file): file is string => Boolean(file))

    for (const requiredFile of requiredFiles) {
      if (!packedFiles.has(requiredFile)) {
        throw new Error(
          `${packageJson.name} is missing ${requiredFile} from its published tarball.`,
        )
      }
    }
  }
} finally {
  rmSync(npmCache, { recursive: true, force: true })
}

console.log(
  `Verified publish contents for ${packageDirectories.length} packages.`,
)
