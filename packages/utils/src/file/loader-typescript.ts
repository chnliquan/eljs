import { randomUUID } from 'node:crypto'
import { basename, dirname, extname, join } from 'node:path'
import type { TranspileOptions } from 'typescript'

import { pathExists, pathExistsSync } from './is'
import { loadTypeScript } from './loader-dependencies'
import { loadJs, loadJsSync } from './loader-javascript'
import { readFile, readFileSync } from './read'
import { remove, removeSync } from './remove'
import { writeFile, writeFileSync } from './write'

let typescript: typeof import('typescript')

/**
 * 惰性加载 TypeScript 运行时并在后续调用中复用
 * @returns TypeScript 运行时
 * @internal
 */
function getTypeScript(): typeof import('typescript') {
  typescript ||= loadTypeScript()
  return typescript
}

/**
 * 为转译产物创建同目录下的唯一临时路径
 * @param filePath - TypeScript 源文件路径
 * @returns 临时 CommonJS 文件路径
 * @internal
 */
function createTranspiledPath(filePath: string): string {
  const extension = extname(filePath)
  const fileName = basename(filePath, extension)

  return join(
    dirname(filePath),
    `.${fileName}.eljs-${process.pid}-${randomUUID()}.cjs`,
  )
}

/**
 * 加载 TypeScript 文件
 * @param path - 文件路径
 * @returns 模块导出
 * @throws 配置解析、转译、写入或加载失败时抛出错误
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadTs<T = any>(path: string): Promise<T> {
  const ts = getTypeScript()
  const compiledPath = createTranspiledPath(path)

  try {
    const config = resolveTsConfig(dirname(path)) ?? {}
    config.compilerOptions = {
      ...config.compilerOptions,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ES2022,
      noEmit: false,
    }
    const content = await readFile(path)
    let transpiledContent = ''

    try {
      transpiledContent = ts.transpileModule(content, config).outputText
    } catch (error) {
      const err = error as Error
      err.message = `TypeScript Error in ${path}: ${err.message}`
      throw err
    }

    await writeFile(compiledPath, transpiledContent)
    return (await loadJs(compiledPath)) as T
  } finally {
    if (await pathExists(compiledPath)) {
      await remove(compiledPath)
    }
  }
}

/**
 * 同步加载 TypeScript 文件
 * @param path - 文件路径
 * @returns 模块导出
 * @throws 配置解析、转译、写入或加载失败时抛出错误
 */
export function loadTsSync<T>(path: string): T {
  const ts = getTypeScript()
  const compiledPath = createTranspiledPath(path)

  try {
    const config = resolveTsConfig(dirname(path)) ?? {}
    config.compilerOptions = {
      ...config.compilerOptions,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ES2022,
      noEmit: false,
    }
    const content = readFileSync(path)
    let transpiledContent = ''

    try {
      transpiledContent = ts.transpileModule(content, config).outputText
    } catch (error) {
      const err = error as Error
      err.message = `TypeScript Error in ${path}: ${err.message}`
      throw err
    }

    writeFileSync(compiledPath, transpiledContent)
    return loadJsSync<T>(compiledPath)
  } finally {
    if (pathExistsSync(compiledPath)) {
      removeSync(compiledPath)
    }
  }
}

/**
 * 解析离目标目录最近的 tsconfig 文件
 * @param dir - 文件夹
 * @returns 可直接传给 `transpileModule` 的配置，未找到配置时返回空对象
 * @throws 配置文件无法读取或包含无效编译选项时抛出错误
 */
export function resolveTsConfig(dir: string): TranspileOptions {
  const ts = getTypeScript()
  const configPath = ts.findConfigFile(dir, fileName => {
    return ts.sys.fileExists(fileName)
  })

  if (configPath !== undefined) {
    const { config, error } = ts.readConfigFile(configPath, filePath =>
      ts.sys.readFile(filePath),
    )

    if (error) {
      throw new Error(
        `Resolve file ${configPath} failed: ${ts.flattenDiagnosticMessageText(error.messageText, '\n')}`,
      )
    }

    const parsed = ts.parseJsonConfigFileContent(
      config,
      ts.sys,
      dirname(configPath),
      undefined,
      configPath,
    )

    if (parsed.errors.length > 0) {
      const message = parsed.errors
        .map(diagnostic =>
          ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
        )
        .join('\n')
      throw new Error(`Resolve file ${configPath} failed: ${message}`)
    }

    return { compilerOptions: parsed.options }
  }

  return {}
}
