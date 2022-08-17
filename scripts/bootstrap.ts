/* eslint-disable @typescript-eslint/no-var-requires */
// create package.json, README, etc. for packages that don't have them yet.

import path from 'path'
import { argv, chalk, fs } from 'zx'
import { logger } from './logger'
import { isDirectory } from './utils'

const step = logger.step('Bootstrap')
const version = require('../package.json').version

const packagesDir = path.resolve(__dirname, '../packages')
let files = fs.readdirSync(packagesDir)

if (argv._.length) {
  files = argv._
}

files.forEach(shortName => {
  if (!isDirectory(path.join(packagesDir, shortName))) {
    return
  }

  const name = `@eljs/${shortName}`
  step(`Initializing ${chalk.cyanBright.bold(name)}`)
  console.log()

  ensurePkgJson(name, shortName)
  ensureReadme(name, shortName)
  ensureSrcIndex(shortName)
  ensureTsconfig(shortName)
})

function ensurePkgJson(name: string, shortName: string): void {
  const pkgJSONPath = path.join(packagesDir, shortName, `package.json`)
  const pkgJSONExists = fs.existsSync(pkgJSONPath)

  if (pkgJSONExists) {
    const pkg = require(pkgJSONPath)

    if (pkg.private) {
      return
    }
  }

  if (argv.force || !pkgJSONExists) {
    const json = {
      name,
      version,
      description: name,
      keywords: ['eljs', shortName],
      main: 'lib/index.js',
      types: `lib/index.d.ts`,
      files: [`lib`],
      scripts: {
        dev: 'tsc --watch',
        build: 'tsc',
      },
      repository: {
        type: 'git',
        url: 'git@github.com:chnliquan/eljs.git',
      },
      homepage: `https://github.com/chnliquan/eljs/tree/master/packages/${shortName}#readme`,
      bugs: {
        url: 'https://github.com/chnliquan/eljs/issues',
      },
      author: 'liquan',
      license: 'MIT',
    }

    if (pkgJSONExists) {
      const pkg = require(pkgJSONPath)
      ;[
        'description',
        'keywords',
        'main',
        'types',
        'files',
        'scripts',
        'dependencies',
        'devDependencies',
        'peerDependencies',
        'author',
        'sideEffects',
      ].forEach(key => {
        if (pkg[key]) {
          json[key] = pkg[key]
        }
      })
    }

    fs.writeFileSync(pkgJSONPath, JSON.stringify(json, null, 2))
  }
}

function ensureReadme(name: string, shortName: string): void {
  const readmePath = path.join(packagesDir, shortName, `README.md`)

  if (!fs.existsSync(readmePath)) {
    fs.writeFileSync(
      readmePath,
      `
# ${name}

eljs ${shortName}

## 快速开始

1. 安装

\`\`\`bash
$ npm i ${name} -S
// or
$ yarn add ${name}
// or
$ pnpm add ${name}
\`\`\`

2. 使用

\`\`\`ts
import ${shortName} from '${name}'
\`\`\`

## API


## 开发

\`\`\`bash
// dev
$ pnpm -F '@eljs/${shortName}' dev
// build
$ pnpm -F '@eljs/${shortName}' build
\`\`\`

> 在根路径下执行

## 发布

1. [语义化提交 Commit](https://www.conventionalcommits.org/en/v1.0.0/#summary) 

\`\`\`bash
$ git commit -m 'feat(${shortName}): add some feature'
$ git commit -m 'fix(${shortName}): fix some bug'
\`\`\`

2. 执行发包命令

\`\`\`bash
$ pnpm release

Options:
  --skipTests skip package test
  --skipBuild skip package build
\`\`\`

> 在根路径下执行  
  `.trim() + '\n',
    )
  }
}

function ensureSrcIndex(shortName: string): void {
  const srcDir = path.join(packagesDir, shortName, `src`)
  const indexPath = path.join(packagesDir, shortName, `src/index.ts`)

  if (!fs.existsSync(indexPath)) {
    if (!fs.existsSync(srcDir)) {
      fs.mkdirSync(srcDir)
    }

    fs.writeFileSync(
      indexPath,
      `
export {}
  `.trim() + '\n',
    )
  }
}

function ensureTsconfig(shortName: string): void {
  const tsconfigPath = path.join(packagesDir, shortName, `tsconfig.json`)

  if (!fs.existsSync(tsconfigPath)) {
    fs.writeFileSync(
      tsconfigPath,
      `
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./lib"
  },
  "include": ["src"]
}      
  `.trim() + '\n',
    )
  }
}
