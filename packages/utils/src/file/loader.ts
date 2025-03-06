import importFresh from 'import-fresh'
import path from 'path'
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
import { pathToFileURL } from 'url'

import { isPathExists, isPathExistsSync } from './is'
import { readFile, readFileSync } from './read'
import { remove, removeSync } from './remove'
import { writeFile, writeFileSync } from './write'

/**
 * 加载 js 文件
 * @param filepath 文件路径
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadJsSync(filepath: string): any {
  return importFresh(filepath)
}

/**
 * 加载 js 文件
 * @param filepath 文件路径
 */
async function loadJs(filepath: string) {
  try {
    const { href } = pathToFileURL(filepath)
    return (await import(href)).default
  } catch (error) {
    try {
      return loadJsSync(filepath)
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
 * @param filepath 文件路径
 */
export function loadTsSync(filepath: string) {
  const compiledFilepath = `${filepath.slice(0, -2)}cjs`
  try {
    const config = resolveTsConfig(path.dirname(filepath)) ?? {}
    config.compilerOptions = {
      ...config.compilerOptions,
      module: ModuleKind.NodeNext,
      moduleResolution: ModuleResolutionKind.NodeNext,
      target: ScriptTarget.ES2022,
      noEmit: false,
    }
    const transpiledContent = transpileModule(
      readFileSync(filepath),
      config,
    ).outputText
    writeFileSync(compiledFilepath, transpiledContent)
    return loadJsSync(compiledFilepath)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    error.message = `TypeScript Error in ${filepath}:\n${error.message}`
    throw error
  } finally {
    if (isPathExistsSync(compiledFilepath)) {
      removeSync(compiledFilepath)
    }
  }
}

/**
 * 异步加载 ts 文件
 * @param filepath 文件路径
 */
export async function loadTs(filepath: string) {
  const compiledFilepath = `${filepath.slice(0, -2)}mjs`
  let transpiledContent = ''

  try {
    try {
      const config = resolveTsConfig(path.dirname(filepath)) ?? {}
      config.compilerOptions = {
        ...config.compilerOptions,
        module: ModuleKind.ES2022,
        moduleResolution: ModuleResolutionKind.Bundler,
        target: ScriptTarget.ES2022,
        noEmit: false,
      }
      const content = await readFile(filepath)
      transpiledContent = transpileModule(content, config).outputText
      await writeFile(compiledFilepath, transpiledContent)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      err.message = `TypeScript Error in ${filepath}:\n${err.message}`
      throw err
    }

    return await loadJs(compiledFilepath)
  } finally {
    if (await isPathExists(compiledFilepath)) {
      await remove(compiledFilepath)
    }
  }
}

/**
 * 解析 tsconfig 文件
 * @param dir 文件夹
 */
export function resolveTsConfig(dir: string): TranspileOptions {
  const filePath = findConfigFile(dir, fileName => {
    return sys.fileExists(fileName)
  })

  if (filePath !== undefined) {
    const { config, error } = readConfigFile(filePath, path =>
      sys.readFile(path),
    )
    if (error) {
      throw new Error(`Error in ${filePath}: ${error.messageText.toString()}`)
    }

    return config
  }

  return {}
}
