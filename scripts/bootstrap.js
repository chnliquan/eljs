// create package.json, README, etc. for packages that don't have them yet.

const fs = require('fs')
const path = require('path')
const { minimist, isDirectory, logger, chalk, camelize } = require('@eljs/node-utils')

const args = minimist(process.argv.slice(2))
const step = logger.step('Bootstrap')
const version = require('../package.json').version

const packagesDir = path.resolve(__dirname, '../packages')
let files = fs.readdirSync(packagesDir)

if (args._.length) {
  files = args._
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
  ensureRootIndex(shortName)
  ensureApiExtractorConfig(shortName)
})

function ensurePkgJson(name, shortName) {
  const pkgJSONPath = path.join(packagesDir, shortName, `package.json`)
  const pkgJSONExists = fs.existsSync(pkgJSONPath)

  if (pkgJSONExists) {
    const pkg = require(pkgJSONPath)

    if (pkg.private) {
      return
    }
  }

  if (args.force || !pkgJSONExists) {
    const json = {
      name,
      version,
      description: name,
      keywords: ['eljs', shortName],
      main: 'index.js',
      types: `dist/${shortName}.d.ts`,
      module: `dist/${shortName}.esm.js`,
      files: [`index.js`, `dist`],
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
        'dependencies',
        'devDependencies',
        'peerDependencies',
        'files',
        'author',
        'types',
        'sideEffects',
        'main',
        'module',
      ].forEach(key => {
        if (pkg[key]) {
          json[key] = pkg[key]
        }
      })
    }

    fs.writeFileSync(pkgJSONPath, JSON.stringify(json, null, 2))
  }
}

function ensureReadme(name, shortName) {
  const readmePath = path.join(packagesDir, shortName, `README.md`)

  if (!fs.existsSync(readmePath)) {
    fs.writeFileSync(
      readmePath,
      `
# ${name}

eljs ${shortName}


# Getting Started

1. Installation

\`\`\`bash
$ npm i ${name} -S
// or
$ yarn add ${name}
\`\`\`

2. Usage

\`\`\`ts
import ${camelize(shortName)} from '${name}'
\`\`\`

# API


# Development

\`\`\`bash
// dev
$ pnpm dev ${shortName}
// build
$ pnpm build ${shortName} -t

Options:
  -t, --types    build source and type declaration
  -f, --formats  specify the build type, \`cjs\`、\`esm\`、\`iife\`, default is \`cjs\`、\`esm\`
  -d, --devOnly  build dev bundle only
  -p, --prodOnly build prod bundle only
  -a, --all      whether build all matching package
\`\`\`

> Run in the root directory.

# Publish

1. [commit semantically with scope](https://www.conventionalcommits.org/en/v1.0.0/#summary) 

\`\`\`bash
$ git commit -m 'feat(${shortName}): add some feature'
$ git commit -m 'fix(${shortName}): fix some bug'
\`\`\`

2. release

\`\`\`bash
$ pnpm release

Options:
  --skipTests skip package test
  --skipBuild skip package build
\`\`\`

> Run in the root directory.

`.trim() + '\n'
    )
  }
}

function ensureSrcIndex(shortName) {
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
`.trim() + '\n'
    )
  }
}

function ensureRootIndex(shortName) {
  const rootIndexPath = path.join(packagesDir, shortName, 'index.js')

  if (!fs.existsSync(rootIndexPath)) {
    fs.writeFileSync(
      rootIndexPath,
      `
'use strict'

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./dist/${shortName}.cjs.prod.js')
} else {
  module.exports = require('./dist/${shortName}.cjs.js')
}
`.trim() + '\n'
    )
  }
}

function ensureApiExtractorConfig(shortName) {
  const apiExtractorConfigPath = path.join(packagesDir, shortName, `api-extractor.json`)

  if (!fs.existsSync(apiExtractorConfigPath)) {
    fs.writeFileSync(
      apiExtractorConfigPath,
      `
{
  "extends": "../../api-extractor.json",
  "mainEntryPointFilePath": "./dist/packages/<unscopedPackageName>/src/index.d.ts",
  "dtsRollup": {
    "publicTrimmedFilePath": "./dist/<unscopedPackageName>.d.ts"
  }
}
`.trim() + '\n'
    )
  }
}
