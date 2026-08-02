// create package.json, README, etc. for packages that don't have them yet.
import {
  mkdirSync,
  pathExistsSync,
  readJson,
  readJsonSync,
  writeFileAtomicSync,
  writeJsonSync,
} from '@eljs/utils/file'
import { logger } from '@eljs/utils/logger'
import { getWorkspacePackageRoots } from '@eljs/utils/path'
import { camelCase } from '@eljs/utils/string'
import type { PackageJson } from '@eljs/utils/types'
import { EOL } from 'node:os'
import path from 'node:path'
import { argv, chalk } from 'zx'

const step = logger.step('Create package')
const preservedPackageFields = [
  'description',
  'keywords',
  'author',
  'bin',
  'type',
  'sideEffects',
  'main',
  'module',
  'types',
  'exports',
  'files',
  'engines',
  'scripts',
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
  'peerDependenciesMeta',
  'publishConfig',
] as const

interface CreatePackageManifestOptions {
  name: string
  version: string
  dirname: string
  shortName: string
  existingPackageJson?: PackageJson
}

interface PackageManifest extends PackageJson {
  repository?: NonNullable<PackageJson['repository']> & {
    directory?: string
  }
}

function createPackageManifest({
  name,
  version,
  dirname,
  shortName,
  existingPackageJson,
}: CreatePackageManifestOptions): PackageManifest {
  const manifest: PackageManifest = {
    name,
    version,
    description: name,
    keywords: ['eljs', shortName],
    homepage: `https://github.com/chnliquan/eljs/tree/master/${dirname}#readme`,
    bugs: {
      url: 'https://github.com/chnliquan/eljs/issues',
    },
    repository: {
      type: 'git',
      url: 'https://github.com/chnliquan/eljs.git',
      directory: dirname,
    },
    license: 'MIT',
    author: 'chnliquan',
    type: 'module',
    main: './dist/index.cjs',
    module: './dist/index.js',
    types: './dist/index.d.ts',
    exports: {
      '.': {
        import: {
          types: './dist/index.d.ts',
          default: './dist/index.js',
        },
        require: {
          types: './dist/index.d.cts',
          default: './dist/index.cjs',
        },
        default: './dist/index.js',
      },
      './package.json': './package.json',
    },
    files: ['dist'],
    engines: {
      node: '>=22.14.0',
    },
    scripts: {
      build: 'rslib build',
      clean: 'rimraf dist',
      dev: 'rslib build --watch',
      typecheck: 'tsc --noEmit && tsc --noEmit -p tsconfig.build.json',
    },
  }

  if (!existingPackageJson) {
    return manifest
  }

  for (const field of preservedPackageFields) {
    const value = existingPackageJson[field]

    if (value !== undefined) {
      Object.assign(manifest, { [field]: value })
    }
  }

  return manifest
}

function createTsconfigFiles(): Record<
  'tsconfig.json' | 'tsconfig.build.json',
  string
> {
  return {
    'tsconfig.json':
      `
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "declaration": false,
    "declarationMap": false,
    "noEmit": true,
    "noUnusedLocals": false,
    "types": ["node"],
    "verbatimModuleSyntax": false
  },
  "include": ["src", "__tests__"]
}
`.trim() + '\n',
    'tsconfig.build.json':
      `
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "declarationMap": false,
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src"]
}
`.trim() + '\n',
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(`create package error:${EOL}${error.message}.`)
    process.exit(1)
  })

async function main(): Promise<void> {
  const rootPath = path.resolve(__dirname, '../')
  const pkgPaths = await getWorkspacePackageRoots(rootPath, true)
  const { version } = await readJson<PackageJson>(
    path.resolve(rootPath, 'package.json'),
  )

  const dirs = argv._.length ? argv._ : pkgPaths

  dirs.forEach(dirname => {
    const pairs = dirname.split('/')
    const shortName =
      pairs.length > 1 ? dirname.replace(`${pairs[0]}/`, '') : dirname
    const name = `@eljs/${shortName}`
    step(`Initializing ${chalk.cyan(name)}`)
    console.log()

    const pkgDir = path.resolve(rootPath, dirname)

    if (!pathExistsSync(pkgDir)) {
      mkdirSync(pkgDir)
    }

    ensurePackageJson(name, version as string, dirname, shortName)
    ensureReadme(name, dirname, shortName)
    ensureSrcIndex(dirname)
    ensureRslibConfig(dirname)
    ensureTsconfig(dirname)
  })
}

function ensurePackageJson(
  name: string,
  version: string,
  dirname: string,
  shortName: string,
): void {
  const pkgJSONPath = path.resolve(dirname, `package.json`)
  const pkgJSONExists = pathExistsSync(pkgJSONPath)
  let pkgJSON: PackageJson = Object.create(null)

  if (pkgJSONExists) {
    pkgJSON = readJsonSync(pkgJSONPath)

    if (pkgJSON.private) {
      return
    }
  }

  if (argv.force || !pkgJSONExists) {
    const json = createPackageManifest({
      name,
      version,
      dirname,
      shortName,
      existingPackageJson: pkgJSONExists ? pkgJSON : undefined,
    })

    step('Generate package.json')
    writeJsonSync(pkgJSONPath, json)
  }
}

function ensureReadme(name: string, dirname: string, shortName: string): void {
  const readmePath = path.resolve(dirname, `README.md`)

  if (!pathExistsSync(readmePath)) {
    step('Generate README.md')
    writeFileAtomicSync(
      readmePath,
      `
# ${name}

${name}

## Installation

\`\`\`bash
$ pnpm add ${name}
// or
$ yarn add ${name}
// or
$ npm i ${name} -S
\`\`\`

## Usage

\`\`\`ts
import ${camelCase(shortName)} from '${name}'
\`\`\`

## API


## Development

\`\`\`bash
$ pnpm run dev --filter ${name}
// or
$ pnpm -F ${name} run dev
\`\`\`

## Publish

### 1. [Conventional Commit](https://www.conventionalcommits.org/en/v1.0.0/#summary) 

\`\`\`bash
$ git commit -m 'feat(${shortName}): add some feature'
$ git commit -m 'fix(${shortName}): fix some bug'
\`\`\`

### 2. Compile（optional）

\`\`\`bash
$ pnpm run build --filter ${name}
// or
$ pnpm -F ${name} run build
\`\`\`

### 3. Release

\`\`\`bash
$ pnpm run release

Options:
  --skipTests             Skip unit tests.
  --skipBuild             Skip package build.
  --skipRequireClean      Skip git working tree check.
\`\`\`
  `.trim() + '\n',
    )
  }
}

function ensureSrcIndex(dirname: string): void {
  const srcDir = path.resolve(dirname, `src`)
  const indexPath = path.resolve(dirname, `src/index.ts`)

  if (!pathExistsSync(indexPath)) {
    if (!pathExistsSync(srcDir)) {
      mkdirSync(srcDir)
    }

    writeFileAtomicSync(
      indexPath,
      `
export {}
  `.trim() + EOL,
    )
  }
}

function ensureRslibConfig(dirname: string): void {
  const rslibConfigPath = path.resolve(dirname, 'rslib.config.ts')

  if (!pathExistsSync(rslibConfigPath)) {
    step('Generate rslib.config.ts')
    writeFileAtomicSync(
      rslibConfigPath,
      `
export { default } from '../../rslib.base.config.ts'
`.trim() + EOL,
    )
  }
}

function ensureTsconfig(dirname: string): void {
  const ensureTsconfigPath = path.resolve(dirname, `tsconfig.json`)
  const ensureBuildTsconfigPath = path.resolve(dirname, `tsconfig.build.json`)
  const tsconfigFiles = createTsconfigFiles()

  if (!pathExistsSync(ensureTsconfigPath)) {
    step('Generate tsconfig.json')
    writeFileAtomicSync(ensureTsconfigPath, tsconfigFiles['tsconfig.json'])
  }

  if (!pathExistsSync(ensureBuildTsconfigPath)) {
    step('Generate tsconfig.build.json')
    writeFileAtomicSync(
      ensureBuildTsconfigPath,
      tsconfigFiles['tsconfig.build.json'],
    )
  }
}
