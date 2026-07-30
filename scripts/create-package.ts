// create package.json, README, etc. for packages that don't have them yet.
import {
  camelCase,
  getWorkspaces,
  isPathExistsSync,
  logger,
  mkdirSync,
  PackageJson,
  readJson,
  readJsonSync,
  safeWriteFileSync,
  writeJsonSync,
} from '@eljs/utils'
import { EOL } from 'node:os'
import path from 'node:path'
import { argv, chalk } from 'zx'

import {
  createPackageManifest,
  createTsconfigFiles,
} from './internal/create-package'

const step = logger.step('Create package')

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(`create package error:${EOL}${error.message}.`)
    process.exit(1)
  })

async function main(): Promise<void> {
  const rootPath = path.resolve(__dirname, '../')
  const pkgPaths = await getWorkspaces(rootPath, true)
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

    if (!isPathExistsSync(pkgDir)) {
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
  const pkgJSONExists = isPathExistsSync(pkgJSONPath)
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

  if (!isPathExistsSync(readmePath)) {
    step('Generate README.md')
    safeWriteFileSync(
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

  if (!isPathExistsSync(indexPath)) {
    if (!isPathExistsSync(srcDir)) {
      mkdirSync(srcDir)
    }

    safeWriteFileSync(
      indexPath,
      `
export {}
  `.trim() + EOL,
    )
  }
}

function ensureRslibConfig(dirname: string): void {
  const rslibConfigPath = path.resolve(dirname, 'rslib.config.ts')

  if (!isPathExistsSync(rslibConfigPath)) {
    step('Generate rslib.config.ts')
    safeWriteFileSync(
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

  if (!isPathExistsSync(ensureTsconfigPath)) {
    step('Generate tsconfig.json')
    safeWriteFileSync(ensureTsconfigPath, tsconfigFiles['tsconfig.json'])
  }

  if (!isPathExistsSync(ensureBuildTsconfigPath)) {
    step('Generate tsconfig.build.json')
    safeWriteFileSync(
      ensureBuildTsconfigPath,
      tsconfigFiles['tsconfig.build.json'],
    )
  }
}
