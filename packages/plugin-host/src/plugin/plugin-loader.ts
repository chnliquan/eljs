import { fileLoaders, fileLoadersSync } from '@eljs/utils/loader'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { extname } from 'node:path'

import {
  getPluginHostErrorMessage,
  PluginHostError,
  PluginHostErrorCode,
} from '../errors'
import { isOptionsSchema } from './options-schema'
import type { PluginInitializer, PluginType } from './types'

const localRequire = createRequire(import.meta.url)
let typescript: typeof import('typescript')

/**
 * 直接从原始路径加载 TypeScript 插件，并在本次同步模块图加载期间支持本地
 * `.ts` 和 `.cts` 依赖
 *
 * @remarks
 * 每个模块执行前检查语法诊断，不执行完整类型检查；入口及依赖沿用固定 CommonJS 转译选项
 * 单文件临时转译会让无扩展名的相对导入落到不存在的 `.js` 文件
 * require Hook 在同步加载结束或失败时恢复，语法错误不会执行当前模块，但此前已执行模块的副作用不会回滚
 *
 * @param path - TypeScript 插件入口的绝对路径
 * @returns 插件模块导出的值
 * @throws 转译、语法检查或模块执行失败时抛出包含源文件路径的错误
 */
function loadTypeScriptPlugin(path: string): unknown {
  if (!typescript) {
    typescript = localRequire('typescript') as typeof import('typescript')
  }

  const previousLoaders = {
    '.cts': localRequire.extensions['.cts'],
    '.ts': localRequire.extensions['.ts'],
  }

  const loadTypeScript: NodeJS.RequireExtensions[string] = (
    module,
    filename,
  ) => {
    const content = readFileSync(filename, 'utf8')
    const result = typescript.transpileModule(content, {
      compilerOptions: {
        esModuleInterop: true,
        module: typescript.ModuleKind.CommonJS,
        moduleResolution: typescript.ModuleResolutionKind.Node10,
        target: typescript.ScriptTarget.ES2022,
      },
      fileName: filename,
      reportDiagnostics: true,
    })
    // 与配置加载器一致，仅检查带源文件的语法诊断，避免执行被转译器容错修复的无效源码
    const diagnostics = result.diagnostics?.filter(
      diagnostic => diagnostic.file !== undefined,
    )
    if (diagnostics?.length) {
      throw new SyntaxError(
        `TypeScript Error in ${filename}: ${diagnostics
          .map(diagnostic =>
            typescript.flattenDiagnosticMessageText(
              diagnostic.messageText,
              '\n',
            ),
          )
          .join('\n')}`,
      )
    }

    ;(
      module as NodeModule & {
        _compile(content: string, filename: string): void
      }
    )._compile(result.outputText, filename)
  }
  localRequire.extensions['.cts'] = loadTypeScript
  localRequire.extensions['.ts'] = loadTypeScript

  try {
    return fileLoadersSync['.js'](path)
  } finally {
    for (const extension of ['.cts', '.ts'] as const) {
      const previousLoader = previousLoaders[extension]
      if (previousLoader) {
        localRequire.extensions[extension] = previousLoader
      } else {
        delete localRequire.extensions[extension]
      }
    }
  }
}

/**
 * 加载并校验插件入口函数
 *
 * @remarks
 * TypeScript 入口及相对依赖在各自执行前校验语法，错误通过 `PluginLoadFailed` 保留源文件路径
 * 不执行完整类型检查，也不回滚已经执行的模块副作用
 *
 * @param path - 插件入口的绝对路径
 * @param type - 插件声明类型
 * @returns 插件入口函数
 * @throws {@link PluginHostError}
 * 当扩展名不受支持、语法无效、模块无法加载或默认导出不是函数时抛出
 * @internal
 */
export async function loadPluginInitializer(
  path: string,
  type: PluginType,
): Promise<PluginInitializer<unknown>> {
  const extension = extname(path)
  const loader =
    extension === '.ts' || extension === '.cts'
      ? loadTypeScriptPlugin
      : fileLoaders[extension as keyof typeof fileLoaders]

  if (!loader) {
    throw new PluginHostError(
      PluginHostErrorCode.UnsupportedPluginExtension,
      `No loader is available for ${type} ${path}.`,
      { details: { path, pluginType: type } },
    )
  }

  try {
    const content = (await loader(path)) as {
      default?: PluginInitializer<unknown>
    }
    const initializer = content?.default ?? content

    if (typeof initializer !== 'function') {
      throw new PluginHostError(
        PluginHostErrorCode.InvalidPluginExport,
        `Load \`${type}\` failed in ${path}, expected function, but got \`${String(
          initializer,
        )}\`.`,
        { details: { path, pluginType: type } },
      )
    }

    if (
      initializer.optionsSchema !== undefined &&
      !isOptionsSchema(initializer.optionsSchema)
    ) {
      throw new PluginHostError(
        PluginHostErrorCode.InvalidPluginExport,
        `Load \`${type}\` failed in ${path}, optionsSchema must implement Standard Schema V1.`,
        { details: { path, pluginType: type } },
      )
    }

    return initializer as PluginInitializer<unknown>
  } catch (error) {
    if (error instanceof PluginHostError) {
      throw error
    }

    throw new PluginHostError(
      PluginHostErrorCode.PluginLoadFailed,
      `Load \`${type}\` failed in ${path}: ${getPluginHostErrorMessage(error)}`,
      {
        cause: error,
        details: { path, pluginType: type },
      },
    )
  }
}
