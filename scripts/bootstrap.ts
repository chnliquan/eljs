/* eslint-disable @typescript-eslint/no-var-requires */
// create package.json, README, etc. for packages that don't have them yet.
import {
  camelCase,
  getPackageRootPaths,
  isPathExistsSync,
  logger,
  mkdirSync,
  PackageJson,
  readJson,
  readJsonSync,
  safeWriteFileSync,
  writeJsonSync,
} from '@eljs/utils'
import path from 'path'
import { argv, chalk } from 'zx'

const step = logger.step('Bootstrap')

main().catch((err: Error) => {
  console.error(`bootstrap error: ${err.message}.`)
  process.exit(1)
})

async function main(): Promise<void> {
  const rootPath = path.resolve(__dirname, '../')
  const pkgPaths = await getPackageRootPaths(rootPath, true)
  const { version } = await readJson(path.resolve(rootPath, 'package.json'))

  const dirs = argv._.length ? argv._ : pkgPaths

  dirs.forEach(dirname => {
    const pairs = dirname.split('/')
    const shortName =
      pairs.length > 1 ? dirname.replace(`${pairs[0]}/`, '') : dirname
    const name = `@eljs/${shortName}`
    step(`Initializing ${chalk.cyanBright.bold(name)}`)
    console.log()

    const pkgDir = path.resolve(rootPath, dirname)

    if (!isPathExistsSync(pkgDir)) {
      mkdirSync(pkgDir)
    }

    ensurePackageJson(name, version as string, dirname, shortName)
    ensureReadme(name, dirname, shortName)
    ensureSrcIndex(dirname)
    ensureFatherrc(dirname)
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
    const json = {
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
      author: 'liquan',
      main: `lib/index.js`,
      module: `esm/index.js`,
      types: `esm/index.d.ts`,
      files: ['esm/*', 'lib/*'],
      scripts: {
        build: 'father build',
        clean: 'rimraf lib && rimraf esm && rimraf node_modules/.cache/father',
        dev: 'father dev',
      },
    }

    if (pkgJSONExists) {
      ;[
        'description',
        'keywords',
        'author',
        'sideEffects',
        'main',
        'types',
        'files',
        'scripts',
        'dependencies',
        'devDependencies',
        'peerDependencies',
      ].forEach(key => {
        if (pkgJSON[key]) {
          json[key as keyof typeof json] = pkgJSON[key]
        }
      })
    }

    step('Generate package.json')
    writeJsonSync(pkgJSONPath, json)
  }
}

function ensureReadme(name: string, dirname: string, shortName: string): void {
  const readmePath = path.resolve(dirname, `README.md`)

  if (!isPathExistsSync(readmePath)) {
    step('Generate readme.md')
    safeWriteFileSync(
      readmePath,
      `
# ${name}

eljs ${shortName}

## 快速开始

### 1. 安装

\`\`\`bash
$ pnpm add ${name}
// or
$ yarn add ${name}
// or
$ npm i ${name} -S
\`\`\`

### 2. 使用

\`\`\`ts
import ${camelCase(shortName)} from '${name}'
\`\`\`

## API


## 开发

\`\`\`bash
$ pnpm run dev --filter ${name}
// or
$ pnpm -F '${name}' run dev
\`\`\`

## 发布

### 1. [语义化提交 Commit](https://www.conventionalcommits.org/en/v1.0.0/#summary) 

\`\`\`bash
$ git commit -m 'feat(${shortName}): add some feature'
$ git commit -m 'fix(${shortName}): fix some bug'
\`\`\`

### 2. 编译（可选）

\`\`\`bash
$ pnpm run build --filter ${name}
// or
$ pnpm -F '${name}' run build
\`\`\`

### 3. 执行发包命令

\`\`\`bash
$ pnpm run release

Options:
  --skipTests          跳过单元测试
  --skipBuild          跳过打包
  --skipGitCheck       跳过 git 检查
  --skipRegistryCheck  跳过 npm 仓库检查
  --skipOwnershipCheck 跳过发布权限检查
  --skipSyncCnpm       跳过同步 cnpm
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
  `.trim() + '\n',
    )
  }
}

function ensureFatherrc(dirname: string): void {
  const ensureFatherrcPath = path.resolve(dirname, `.fatherrc.ts`)

  if (!isPathExistsSync(ensureFatherrcPath)) {
    step('Generate .fatherrc.ts')
    safeWriteFileSync(
      ensureFatherrcPath,
      `
import { defineConfig } from 'father'

export default defineConfig({
  extends: '../../.fatherrc.base.ts',
})      
`.trim() + '\n',
    )
  }
}

function ensureTsconfig(dirname: string): void {
  const ensureTsconfigPath = path.resolve(dirname, `tsconfig.json`)

  if (!isPathExistsSync(ensureTsconfigPath)) {
    step('Generate tsconfig.json')
    safeWriteFileSync(
      ensureTsconfigPath,
      `
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "declarationDir": "esm",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src", "../../global.d.ts"]
}         
`.trim() + '\n',
    )
  }
}
