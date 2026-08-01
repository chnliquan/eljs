import { fileLoaders, fileLoadersSync } from '@eljs/utils'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { extname } from 'node:path'

import { PluginHostError, PluginHostErrorCode } from '../errors'
import { isOptionsSchema } from './options-schema'
import type { PluginInitializer, PluginType } from './types'

const localRequire = createRequire(
  typeof __filename === 'string' ? __filename : import.meta.url,
)
let typescript: typeof import('typescript')

/**
 * 直接从原始路径加载 TypeScript 插件，并在本次同步模块图加载期间支持本地
 * `.ts` 依赖。单文件临时转译会让无扩展名的相对导入落到不存在的 `.js` 文件
 *
 * @param path - TypeScript 插件入口的绝对路径
 * @returns 插件模块导出的值
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
    const transpiledContent = typescript.transpileModule(content, {
      compilerOptions: {
        esModuleInterop: true,
        module: typescript.ModuleKind.CommonJS,
        moduleResolution: typescript.ModuleResolutionKind.Node10,
        target: typescript.ScriptTarget.ES2022,
      },
      fileName: filename,
    }).outputText

    ;(
      module as NodeModule & {
        _compile(content: string, filename: string): void
      }
    )._compile(transpiledContent, filename)
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
 * @param path - 插件入口的绝对路径
 * @param type - 插件声明类型
 * @returns 插件入口函数
 * @throws {@link PluginHostError}
 * 当扩展名不受支持、模块无法加载或默认导出不是函数时抛出
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
      `Load \`${type}\` failed in ${path}: ${(error as Error).message}`,
      {
        cause: error,
        details: { path, pluginType: type },
      },
    )
  }
}
