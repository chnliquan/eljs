import { resolve } from '@eljs/utils/module'

import type {
  PluginDeclaration,
  PluginOrigin,
  ResolvedPlugin,
} from '../core/types'
import { PluginHostError, PluginHostErrorCode } from '../errors'
import { Plugin } from './plugin'
import { SUPPORTED_PLUGIN_EXTENSIONS } from './plugin-formats'
import type { PluginType } from './types'

/**
 * 将插件声明解析为插件实例、插件选项和来源信息
 *
 * @param declarations - 待解析的插件声明
 * @param type - 声明对应的插件类型
 * @param cwd - 解析模块时使用的工作目录
 * @param origin - 声明来源信息
 * @returns 解析后的插件元组
 * @throws {@link PluginHostError}
 * 当任一插件声明无法解析时抛出
 */
export function resolvePluginDeclarations(
  declarations: readonly PluginDeclaration[],
  type: PluginType,
  cwd: string,
  origin: Omit<PluginOrigin, 'declaration'> = {
    source: 'configuration',
  },
): ResolvedPlugin[] {
  return declarations.map(declaration => {
    if (
      typeof declaration !== 'string' &&
      (!Array.isArray(declaration) ||
        declaration.length !== 2 ||
        typeof declaration[0] !== 'string')
    ) {
      throw new PluginHostError(
        PluginHostErrorCode.InvalidPluginDeclaration,
        `Invalid ${type} declaration, expected a module name or a [module name, options] tuple.`,
        { details: { declaration, pluginType: type } },
      )
    }

    const [pluginName, pluginOptions] =
      typeof declaration === 'string' ? [declaration, undefined] : declaration

    if (!pluginName.trim()) {
      throw new PluginHostError(
        PluginHostErrorCode.InvalidPluginDeclaration,
        `Invalid ${type} declaration, module name must not be empty.`,
        { details: { declaration, pluginType: type } },
      )
    }

    let resolvedPath: string
    try {
      resolvedPath = resolve.sync(pluginName, {
        basedir: cwd,
        extensions: [...SUPPORTED_PLUGIN_EXTENSIONS].reverse(),
      })
    } catch (error) {
      throw new PluginHostError(
        PluginHostErrorCode.PluginResolveFailed,
        `Invalid plugin \`${pluginName}\`, can not be resolved.`,
        {
          cause: error,
          details: { cwd, pluginName, pluginType: type },
        },
      )
    }

    return [
      new Plugin({ path: resolvedPath, type, cwd }),
      pluginOptions,
      { ...origin, declaration: pluginName },
    ] as ResolvedPlugin
  })
}

/**
 * 分别解析 preset 与 plugin 声明
 *
 * @param cwd - 解析模块时使用的工作目录
 * @param presets - preset 声明集合
 * @param plugins - plugin 声明集合
 * @param origin - 声明来源信息
 * @returns 分类后的 preset 与 plugin 解析结果
 */
export function resolvePresetsAndPlugins(
  cwd: string,
  presets?: readonly PluginDeclaration[],
  plugins?: readonly PluginDeclaration[],
  origin: Omit<PluginOrigin, 'declaration'> = {
    source: 'configuration',
  },
): {
  presets?: ResolvedPlugin[]
  plugins?: ResolvedPlugin[]
} {
  return {
    presets: presets?.length
      ? resolvePluginDeclarations(presets, 'preset', cwd, origin)
      : undefined,
    plugins: plugins?.length
      ? resolvePluginDeclarations(plugins, 'plugin', cwd, origin)
      : undefined,
  }
}
