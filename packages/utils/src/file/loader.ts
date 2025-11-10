/* eslint-disable @typescript-eslint/naming-convention */
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { TranspileOptions } from 'typescript'

import { isESModule } from '../type'
import { isPathExists, isPathExistsSync } from './is'
import { readFile, readFileSync } from './read'
import { remove, removeSync } from './remove'
import { writeFile, writeFileSync } from './write'

/**
 * 默认异步加载器
 */
export const fileLoaders = Object.freeze({
  '.mjs': loadJs,
  '.cjs': loadJs,
  '.js': loadJs,
  '.ts': loadTs,
  '.json': loadJson,
  '.yaml': loadYaml,
  '.yml': loadYaml,
} as const)

/**
 * 默认同步加载器
 */
export const fileLoadersSync = Object.freeze({
  '.cjs': loadJsSync,
  '.js': loadJsSync,
  '.ts': loadTsSync,
  '.json': loadJsonSync,
  '.yaml': loadYamlSync,
  '.yml': loadYamlSync,
} as const)

/**
 * 加载 js 文件
 * @param path 文件路径
 */
export async function loadJs<T>(path: string): Promise<T> {
  try {
    const { href } = pathToFileURL(path)
    const content = await import(href)
    // import 会默认给模块包一层 default
    return isESModule<T>(content) ? content.default : content
  } catch (dynamicImportError) {
    const dynamicImportErr = dynamicImportError as Error
    try {
      return loadJsSync(path)
    } catch (requireError) {
      const requireErr = requireError as NodeJS.ErrnoException
      if (
        requireErr.code === 'ERR_REQUIRE_ESM' ||
        (requireErr instanceof SyntaxError &&
          requireErr
            .toString()
            .includes('Cannot use import statement outside a module'))
      ) {
        dynamicImportErr.message = `Load ${path} failed: ${dynamicImportErr.message}`
        throw dynamicImportErr
      }

      requireErr.message = `Load ${path} failed: ${dynamicImportErr.message}`
      throw requireError
    }
  }
}

let importFresh: typeof import('import-fresh')
/**
 * 加载 js 文件
 * @param path 文件路径
 */
export function loadJsSync<T>(path: string): T {
  if (!importFresh) {
    importFresh = require('import-fresh')
  }

  try {
    const content = importFresh(path)
    return content as T
  } catch (error) {
    const err = error as Error
    err.message = `Load ${path} failed: ${err.message}`
    throw err
  }
}

let typescript: typeof import('typescript')
/**
 * 加载 ts 文件
 * @param path 文件路径
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadTs<T = any>(path: string): Promise<T> {
  if (!typescript) {
    typescript = require('typescript')
  }
  const compiledPath = `${path.slice(0, -2)}cjs`

  try {
    const config = resolveTsConfig(dirname(path)) ?? {}
    config.compilerOptions = {
      ...config.compilerOptions,
      module: typescript.ModuleKind.NodeNext,
      moduleResolution: typescript.ModuleResolutionKind.NodeNext,
      target: typescript.ScriptTarget.ES2022,
      noEmit: false,
    }
    const content = await readFile(path)
    let transpiledContent = ''

    try {
      transpiledContent = typescript.transpileModule(content, config).outputText
    } catch (error) {
      const err = error as Error
      err.message = `TypeScript Error in ${path}: ${err.message}`
      throw err
    }

    await writeFile(compiledPath, transpiledContent)
    const js = await loadJs(compiledPath)
    return js as T
  } finally {
    if (await isPathExists(compiledPath)) {
      await remove(compiledPath)
    }
  }
}

/**
 * 加载 ts 文件
 * @param path 文件路径
 */
export function loadTsSync<T>(path: string): T {
  if (!typescript) {
    typescript = require('typescript')
  }
  const compiledPath = `${path.slice(0, -2)}cjs`

  try {
    const config = resolveTsConfig(dirname(path)) ?? {}
    config.compilerOptions = {
      ...config.compilerOptions,
      module: typescript.ModuleKind.NodeNext,
      moduleResolution: typescript.ModuleResolutionKind.NodeNext,
      target: typescript.ScriptTarget.ES2022,
      noEmit: false,
    }
    const content = readFileSync(path)
    let transpiledContent = ''

    try {
      transpiledContent = typescript.transpileModule(content, config).outputText
    } catch (error) {
      const err = error as Error
      err.message = `TypeScript Error in ${path}: ${err.message}`
      throw err
    }

    writeFileSync(compiledPath, transpiledContent)
    const js = loadJsSync(compiledPath)
    return js as T
  } finally {
    if (isPathExistsSync(compiledPath)) {
      removeSync(compiledPath)
    }
  }
}

let parseJson: typeof import('parse-json')
/**
 * 加载 json 文件
 * @param path 文件路径
 */
export async function loadJson<T>(path: string): Promise<T> {
  if (!parseJson) {
    parseJson = require('parse-json')
  }
  const content = await readFile(path)

  try {
    const json = parseJson(content)
    return json
  } catch (error) {
    const err = error as Error
    err.message = `Parse ${path} failed: ${err.message}`
    throw err
  }
}

/**
 * 加载 json 文件
 * @param path 文件路径
 */
export function loadJsonSync<T>(path: string): T {
  if (!parseJson) {
    parseJson = require('parse-json')
  }
  const content = readFileSync(path)

  try {
    const json = parseJson(content)
    return json
  } catch (error) {
    const err = error as Error
    err.message = `Parse ${path} failed: ${err.message}`
    throw err
  }
}

let yaml: typeof import('js-yaml')
/**
 * 加载 yaml 文件
 * @param path 文件路径
 */
export async function loadYaml<T>(path: string): Promise<T> {
  if (!yaml) {
    yaml = require('js-yaml')
  }
  const content = await readFile(path)

  try {
    const data = yaml.load(content)
    return data as T
  } catch (error) {
    const err = error as Error
    err.message = `Load ${path} failed: ${err.message}`
    throw err
  }
}

/**
 * 加载 yaml 文件
 * @param path 文件路径
 */
export function loadYamlSync<T>(path: string): T {
  if (!yaml) {
    yaml = require('js-yaml')
  }
  const content = readFileSync(path)

  try {
    const data = yaml.load(content)
    return data as T
  } catch (error) {
    const err = error as Error
    err.message = `Load ${path} failed: ${err.message}`
    throw err
  }
}

/**
 * 解析 tsconfig 文件
 * @param dir 文件夹
 */
export function resolveTsConfig(dir: string): TranspileOptions {
  const path = typescript.findConfigFile(dir, fileName => {
    return typescript.sys.fileExists(fileName)
  })

  if (path !== undefined) {
    const { config, error } = typescript.readConfigFile(path, path =>
      typescript.sys.readFile(path),
    )

    if (error) {
      throw new Error(
        `Resolve file ${path} failed: ${error.messageText.toString()}`,
      )
    }

    return config
  }

  return {}
}
