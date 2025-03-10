import importFresh from 'import-fresh'
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
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
 * 加载 js 文件
 * @param path 文件路径
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadJsSync<T = any>(path: string): T {
  return importFresh(path)
}

/**
 * 加载 js 文件
 * @param path 文件路径
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadJs<T = any>(path: string): Promise<T> {
  try {
    const { href } = pathToFileURL(path)
    return (await import(href)).default
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
 * 加载 ts 文件
 * @param path 文件路径
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadTsSync<T = any>(path: string): T {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    error.message = `TypeScript Error in ${path}:\n${error.message}`
    throw error
  } finally {
    if (isPathExistsSync(compiledPath)) {
      removeSync(compiledPath)
    }
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      err.message = `TypeScript Error in ${path}:\n${err.message}`
      throw err
    }

    return await loadJs(compiledPath)
  } finally {
    if (await isPathExists(compiledPath)) {
      await remove(compiledPath)
    }
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
