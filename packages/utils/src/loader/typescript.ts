import { dirname } from 'node:path'
import { addHook } from 'pirates'
import type { TranspileOptions } from 'typescript'

import { loadTypeScript } from '../internal/lazy-dependencies'
import { contextualizeError } from './error'
import { loadJsSync } from './javascript'

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
 * 按源文件所在项目的配置转译单个 TypeScript 模块
 *
 * @remarks
 * 输出固定为 CommonJS，使入口及其相对 TypeScript 依赖可以在同一受控加载周期内解析
 * 只检查语法诊断，不执行完整类型检查
 *
 * @param content - TypeScript 源码
 * @param filePath - 当前模块路径
 * @returns 可交给 CommonJS 加载器执行的 JavaScript 源码
 * @throws 转译失败时抛出包含源文件路径的错误
 * @internal
 */
function transpileTypeScript(content: string, filePath: string): string {
  const ts = getTypeScript()
  const config = resolveTsConfig(dirname(filePath)) ?? {}

  try {
    const result = ts.transpileModule(content, {
      ...config,
      fileName: filePath,
      reportDiagnostics: true,
      compilerOptions: {
        ...config.compilerOptions,
        module: ts.ModuleKind.CommonJS,
        moduleResolution: ts.ModuleResolutionKind.Node10,
        target: ts.ScriptTarget.ES2022,
        noEmit: false,
      },
    })
    // transpileModule 只报告语法和选项诊断，带源文件的诊断对应本次源码的语法错误
    const diagnostics = result.diagnostics?.filter(
      diagnostic => diagnostic.file !== undefined,
    )
    if (diagnostics?.length) {
      throw new SyntaxError(
        diagnostics
          .map(diagnostic =>
            ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
          )
          .join('\n'),
      )
    }
    return result.outputText
  } catch (error) {
    throw contextualizeError(error, `TypeScript Error in ${filePath}`)
  }
}

/**
 * 在同步生命周期内安装 TypeScript require Hook 并加载完整相对依赖链
 *
 * @remarks
 * Hook 会在 `finally` 中立即释放，避免影响应用后续模块加载；加载过程保持同步，因此并发调用不会交错修改全局 Hook
 *
 * @param filePath - TypeScript 入口文件路径
 * @returns 模块导出
 * @throws 配置解析、转译或模块执行失败时抛出错误
 * @internal
 */
function loadTypeScriptModule<T>(filePath: string): T {
  const revertHook = addHook(
    (content, filename) => transpileTypeScript(content, filename),
    {
      exts: ['.ts'],
      ignoreNodeModules: true,
    },
  )

  try {
    return loadJsSync<T>(filePath)
  } finally {
    revertHook()
  }
}

/**
 * 加载 TypeScript 文件
 *
 * @remarks
 * 为保证全局转换 Hook 的生命周期不跨越异步边界，转译和模块求值会在返回 Promise 前同步完成
 *
 * @param path - 文件路径，相对路径以当前工作目录为基准
 * @returns 模块导出
 * @throws 配置解析、转译或加载失败时抛出错误
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadTs<T = any>(path: string): Promise<T> {
  return loadTypeScriptModule<T>(path)
}

/**
 * 同步加载 TypeScript 文件
 * @param path - 文件路径，相对路径以当前工作目录为基准
 * @returns 模块导出
 * @throws 配置解析、转译或加载失败时抛出错误
 */
export function loadTsSync<T>(path: string): T {
  return loadTypeScriptModule<T>(path)
}

/**
 * 解析离目标目录最近的 tsconfig 文件
 *
 * @remarks
 * 用于显式指定的单文件加载，忽略空 `files` 或 `include` 未匹配输入的项目发现诊断
 * 其余配置与编译选项错误仍会抛出
 *
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

    const errors = parsed.errors.filter(
      diagnostic => diagnostic.code !== 18002 && diagnostic.code !== 18003,
    )
    if (errors.length > 0) {
      const message = errors
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
