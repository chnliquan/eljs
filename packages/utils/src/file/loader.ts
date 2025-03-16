/* eslint-disable @typescript-eslint/naming-convention */
import importFresh from 'import-fresh'
import yaml from 'js-yaml'
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import parseJson from 'parse-json'
import {
  type TranspileOptions,
  findConfigFile,
  ModuleKind,
  ModuleResolutionKind,
  readConfigFile,
  ScriptTarget,
  sys,
  transpileModule,
} from 'typescript'

import { isPathExists, isPathExistsSync } from './is'
import { readFile, readFileSync } from './read'
import { remove, removeSync } from './remove'
import { writeFile, writeFileSync } from './write'

/**
 * 默认异步加载器
 */
export const defaultLoaders = Object.freeze({
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
export const defaultLoadersSync = Object.freeze({
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
    const content = (await import(href)).default
    return content
  } catch (error) {
    try {
      return loadJsSync(path)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (
        err.code === 'ERR_REQUIRE_ESM' ||
        (err instanceof SyntaxError &&
          err
            .toString()
            .includes('Cannot use import statement outside a module'))
      ) {
        throw error
      }

      throw err
    }
  }
}

/**
 * 加载 js 文件
 * @param path 文件路径
 */
export function loadJsSync<T>(path: string): T {
  return importFresh(path)
}

/**
 * 加载 ts 文件
 * @param path 文件路径
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadTs<T = any>(path: string): Promise<T> {
  const compiledPath = `${path.slice(0, -2)}mjs`
  let transpiledContent = ''

  try {
    try {
      const config = resolveTsConfig(dirname(path)) ?? {}
      config.compilerOptions = {
        ...config.compilerOptions,
        module: ModuleKind.ES2022,
        moduleResolution: ModuleResolutionKind.Bundler,
        target: ScriptTarget.ES2022,
        noEmit: false,
      }
      const content = await readFile(path)
      transpiledContent = transpileModule(content, config).outputText
      await writeFile(compiledPath, transpiledContent)
    } catch (error) {
      const err = error as Error
      err.message = `TypeScript Error in ${path}:\n${err.message}`
      throw err
    }

    return loadJs(compiledPath)
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
  const compiledPath = `${path.slice(0, -2)}cjs`
  try {
    const config = resolveTsConfig(dirname(path)) ?? {}
    config.compilerOptions = {
      ...config.compilerOptions,
      module: ModuleKind.NodeNext,
      moduleResolution: ModuleResolutionKind.NodeNext,
      target: ScriptTarget.ES2022,
      noEmit: false,
    }
    const transpiledContent = transpileModule(
      readFileSync(path),
      config,
    ).outputText
    writeFileSync(compiledPath, transpiledContent)
    return loadJsSync(compiledPath)
  } catch (error) {
    const err = error as Error
    err.message = `TypeScript Error in ${path}:\n${err.message}`
    throw err
  } finally {
    if (isPathExistsSync(compiledPath)) {
      removeSync(compiledPath)
    }
  }
}

/**
 * 加载 json 文件
 * @param path 文件路径
 */
export async function loadJson<T>(path: string): Promise<T> {
  const content = await readFile(path)

  try {
    return parseJson(content)
  } catch (error) {
    const err = error as Error
    err.message = `JSON Error in ${path}:\n${err.message}`
    throw err
  }
}

/**
 * 加载 json 文件
 * @param path 文件路径
 */
export function loadJsonSync<T>(path: string): T {
  const content = readFileSync(path)

  try {
    return parseJson(content)
  } catch (error) {
    const err = error as Error
    err.message = `JSON Error in ${path}:\n${err.message}`
    throw err
  }
}

/**
 * 加载 yaml 文件
 * @param path 文件路径
 */
export async function loadYaml<T>(path: string): Promise<T> {
  const content = await readFile(path)
  try {
    return yaml.load(content) as T
  } catch (error) {
    const err = error as Error
    err.message = `YAML Error in ${path}:\n${err.message}`
    throw err
  }
}

/**
 * 加载 yaml 文件
 * @param path 文件路径
 */
export function loadYamlSync<T>(path: string): T {
  const content = readFileSync(path)
  try {
    return yaml.load(content) as T
  } catch (error) {
    const err = error as Error
    err.message = `YAML Error in ${path}:\n${err.message}`
    throw err
  }
}

/**
 * 解析 tsconfig 文件
 * @param dir 文件夹
 */
export function resolveTsConfig(dir: string): TranspileOptions {
  const path = findConfigFile(dir, fileName => {
    return sys.fileExists(fileName)
  })

  if (path !== undefined) {
    const { config, error } = readConfigFile(path, path => sys.readFile(path))

    if (error) {
      throw new Error(`Error in ${path}: ${error.messageText.toString()}`)
    }

    return config
  }

  return {}
}
