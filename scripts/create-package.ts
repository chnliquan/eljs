// create package.json, README, etc. for packages that don't have them yet.
import {
  mkdirSync,
  pathExistsSync,
  readJson,
  readJsonSync,
  writeFileAtomicSync,
  writeJsonSync,
} from '@eljs/utils/file'
import { chalk, logger } from '@eljs/utils/logger'
import { camelCase } from '@eljs/utils/string'
import type { PackageJson } from '@eljs/utils/types'
import { lstatSync, readdirSync } from 'node:fs'
import { EOL } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs as parseNodeArgs } from 'node:util'

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
  description?: string
  existingPackageJson?: PackageJson
}

interface PackageManifest extends PackageJson {
  repository?: NonNullable<PackageJson['repository']> & {
    directory?: string
  }
}

interface CreatePackageArguments {
  directories: string[]
  description?: string
  force: boolean
}

function parseArguments(args: string[]): CreatePackageArguments {
  const { positionals: directories, values } = parseNodeArgs({
    allowPositionals: true,
    args,
    options: {
      description: { type: 'string' },
      force: { type: 'boolean', default: false },
    },
    strict: true,
  })
  const description = values.description?.trim()

  if (values.description !== undefined && !description) {
    throw new Error('`--description` must be a non-empty string')
  }

  return { description, directories, force: values.force }
}

function createPackageManifest({
  name,
  version,
  dirname,
  shortName,
  description,
  existingPackageJson,
}: CreatePackageManifestOptions): PackageManifest {
  const manifest: PackageManifest = {
    name,
    version,
    description: description || name,
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
    files: ['dist', 'README.md', 'README.zh-CN.md'],
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

  if (description !== undefined) manifest.description = description
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

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  createPackages(
    fileURLToPath(new URL('..', import.meta.url)),
    process.argv.slice(2),
  ).catch(error => {
    console.error(`create package error:${EOL}${error.message}`)
    process.exitCode = 1
  })
}

/**
 * 在指定仓库中补齐包脚手架，已有文件仅在显式 force 的清单更新中覆写
 *
 * @remarks
 * 仓库根目录由受信任的脚本入口提供，用户路径仍必须通过单层包目录校验
 * 新包同时生成双语入口；缺失其中一种语言的既有文档须先人工同步
 *
 * @param rootPath - 受信任的仓库绝对根目录
 * @param args - 与命令行相同的包目录和选项
 * @throws 路径、描述或双语文档状态不符合仓库约定时抛出
 * @internal
 */
export async function createPackages(
  rootPath: string,
  args: readonly string[],
): Promise<void> {
  const cliArguments = parseArguments([...args])
  const pkgPaths = getPackageDirectories(rootPath)
  const { version } = await readJson<PackageJson>(
    path.resolve(rootPath, 'package.json'),
  )

  const dirs = cliArguments.directories.length
    ? cliArguments.directories
    : pkgPaths
  const { description } = cliArguments

  if (description && dirs.length !== 1) {
    throw new Error('`--description` can only be used with one package path')
  }

  dirs.forEach(directory => {
    const { dirname, pkgDir, shortName } = resolvePackageDirectory(
      rootPath,
      directory,
    )
    const name = `@eljs/${shortName}`
    step(`Initializing ${chalk.cyan(name)}`)
    console.log()

    const packageJsonPath = path.join(pkgDir, 'package.json')
    const hasEnglish = pathExistsSync(path.join(pkgDir, 'README.md'))
    const hasChinese = pathExistsSync(path.join(pkgDir, 'README.zh-CN.md'))

    // 不能用空白脚手架冒充既有文档的翻译，检查须先于任何文件写入
    if (hasEnglish !== hasChinese) {
      throw new Error(`Package ${name} requires synchronized bilingual READMEs`)
    }

    if (!pathExistsSync(packageJsonPath) && !description) {
      throw new Error(
        `New package ${name} requires a non-empty \`--description\``,
      )
    }

    if (!pathExistsSync(pkgDir)) {
      mkdirSync(pkgDir)
    }

    ensurePackageJson(
      pkgDir,
      name,
      version as string,
      dirname,
      shortName,
      description,
      cliArguments.force,
    )
    ensureReadme(pkgDir, name, shortName)
    ensureSrcIndex(pkgDir)
    ensureRslibConfig(pkgDir)
    ensureTsconfig(pkgDir)
  })
}

/**
 * 枚举仓库约定的单层 `packages/*` 包目录，避免脚手架为固定布局加载包管理器探测链路
 *
 * @param rootPath - 仓库根目录
 * @returns 相对仓库根目录的包路径
 */
function getPackageDirectories(rootPath: string): string[] {
  return readdirSync(path.resolve(rootPath, 'packages'), {
    withFileTypes: true,
  })
    .filter(entry => entry.isDirectory())
    .map(entry => `packages/${entry.name}`)
}

/**
 * 将输入路径收敛为 `packages/*` 的单层 kebab-case 包目录
 *
 * @param rootPath - 仓库根目录
 * @param directory - 调用方传入的相对或绝对路径
 * @returns 已完成边界校验的包目录信息
 * @throws 路径逃逸工作区、嵌套多层或名称不符合约定时抛出
 */
function resolvePackageDirectory(rootPath: string, directory: string) {
  const packagesDir = path.resolve(rootPath, 'packages')
  const pkgDir = path.resolve(rootPath, directory)
  const shortName = path.relative(packagesDir, pkgDir)

  if (
    !shortName ||
    shortName === '..' ||
    shortName.startsWith(`..${path.sep}`) ||
    path.isAbsolute(shortName) ||
    shortName.includes(path.sep) ||
    !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(shortName)
  ) {
    throw new Error(
      `Package path must be a direct kebab-case child of \`packages/\`: ${directory}`,
    )
  }

  if (pathExistsSync(pkgDir) && lstatSync(pkgDir).isSymbolicLink()) {
    throw new Error(`Package directory cannot be a symbolic link: ${directory}`)
  }

  return {
    dirname: path.posix.join('packages', shortName),
    pkgDir,
    shortName,
  }
}

function ensurePackageJson(
  pkgDir: string,
  name: string,
  version: string,
  dirname: string,
  shortName: string,
  description?: string,
  force = false,
): void {
  const pkgJSONPath = path.join(pkgDir, 'package.json')
  const pkgJSONExists = pathExistsSync(pkgJSONPath)
  let pkgJSON: PackageJson = Object.create(null)

  if (pkgJSONExists) {
    pkgJSON = readJsonSync(pkgJSONPath)

    if (pkgJSON.private) {
      return
    }

    // 显式描述只更新该字段；未使用 force 时不重建已有包的其他元数据
    if (description !== undefined && !force) {
      step('Update package description')
      writeJsonSync(pkgJSONPath, { ...pkgJSON, description })
      return
    }
  }

  if (force || !pkgJSONExists) {
    const json = createPackageManifest({
      name,
      version,
      dirname,
      shortName,
      description,
      existingPackageJson: pkgJSONExists ? pkgJSON : undefined,
    })

    step('Generate package.json')
    writeJsonSync(pkgJSONPath, json)
  }
}

function ensureReadme(pkgDir: string, name: string, shortName: string): void {
  const packageJson = readJsonSync<PackageJson>(
    path.join(pkgDir, 'package.json'),
  )
  const languages = [
    {
      file: 'README.md',
      link: '[English](README.md) | [简体中文](README.zh-CN.md)',
      installation: 'Installation',
      usage: 'Usage',
      api: 'API',
      development: 'Development',
    },
    {
      file: 'README.zh-CN.md',
      link: '[English](README.md) | [简体中文](README.zh-CN.md)',
      installation: '安装',
      usage: '使用',
      api: 'API',
      development: '开发',
    },
  ]

  for (const language of languages) {
    const readmePath = path.join(pkgDir, language.file)
    if (pathExistsSync(readmePath)) continue
    step(`Generate ${language.file}`)
    writeFileAtomicSync(
      readmePath,
      `
# ${name}

${language.link}

${packageJson.description || name}

## ${language.installation}

\`\`\`bash
pnpm add ${name}
# or
yarn add ${name}
# or
npm install ${name}
\`\`\`

## ${language.usage}

\`\`\`ts
import * as ${camelCase(shortName)}Api from '${name}'
\`\`\`

## ${language.api}


## ${language.development}

\`\`\`bash
pnpm --filter ${name} dev
pnpm --filter ${name} typecheck
\`\`\`
  `.trim() + '\n',
    )
  }
}

function ensureSrcIndex(pkgDir: string): void {
  const srcDir = path.join(pkgDir, 'src')
  const indexPath = path.join(srcDir, 'index.ts')

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

function ensureRslibConfig(pkgDir: string): void {
  const rslibConfigPath = path.join(pkgDir, 'rslib.config.ts')

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

function ensureTsconfig(pkgDir: string): void {
  const ensureTsconfigPath = path.join(pkgDir, 'tsconfig.json')
  const ensureBuildTsconfigPath = path.join(pkgDir, 'tsconfig.build.json')
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
