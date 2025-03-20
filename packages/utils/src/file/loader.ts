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

import { isESModule } from '@/type'
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
        dynamicImportErr.message = `Load ${path} failed:\n${dynamicImportErr.message}`
        throw dynamicImportErr
      }

      requireErr.message = `Load ${path} failed:\n${dynamicImportErr.message}`
      throw requireError
    }
  }
}

/**
 * 加载 js 文件
 * @param path 文件路径
 */
export function loadJsSync<T>(path: string): T {
  try {
    const content = importFresh(path) as T
    return isESModule<T>(content) ? content.default : content
  } catch (error) {
    const err = error as Error
    err.message = `Load ${path} failed:\n${err.message}`
    throw err
  }
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
  try {
    const content = await readFile(path)
    const json = parseJson(content)
    return json
  } catch (error) {
    const err = error as Error
    err.message = `Load ${path} failed:\n${err.message}`
    throw err
  }
}

/**
 * 加载 json 文件
 * @param path 文件路径
 */
export function loadJsonSync<T>(path: string): T {
  try {
    const content = readFileSync(path)
    const json = parseJson(content)
    return json
  } catch (error) {
    const err = error as Error
    err.message = `Load ${path} failed:\n${err.message}`
    throw err
  }
}

/**
 * 加载 yaml 文件
 * @param path 文件路径
 */
export async function loadYaml<T>(path: string): Promise<T> {
  try {
    const content = await readFile(path)
    const data = yaml.load(content)
    return data as T
  } catch (error) {
    const err = error as Error
    err.message = `Load ${path} failed:\n${err.message}`
    throw err
  }
}

/**
 * 加载 yaml 文件
 * @param path 文件路径
 */
export function loadYamlSync<T>(path: string): T {
  try {
    const content = readFileSync(path)
    const data = yaml.load(content)
    return data as T
  } catch (error) {
    const err = error as Error
    err.message = `Load ${path} failed:\n${err.message}`
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
