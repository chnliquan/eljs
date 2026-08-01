import type { StandardSchemaV1 } from '@standard-schema/spec'

import { PluginHostError, PluginHostErrorCode } from '../errors'
import type { Plugin } from '../plugin/plugin'
import type { PluginInitializer } from '../plugin/types'
import type { PluginOrigin } from './types'

/**
 * 使用插件声明的 Standard Schema 校验并转换初始化选项
 *
 * @remarks
 * Schema 实现属于插件输入边界，校验器自身异常与结构化 issues 会转换为统一领域错误，
 * 并附带来源链和插件标识以支持配置定位
 *
 * @param plugin - 当前初始化的插件
 * @param initialize - 携带可选 Schema 的插件初始化器
 * @param pluginOptions - 配置或 preset 声明提供的原始选项
 * @param origin - 插件声明来源
 * @returns Schema 转换后的选项，未声明 Schema 时原样返回
 * @throws {@link PluginHostError} Schema 执行失败或选项不符合约束时抛出
 * @internal
 */
export async function parsePluginOptions(
  plugin: Plugin,
  initialize: PluginInitializer<unknown>,
  pluginOptions: unknown,
  origin?: PluginOrigin,
): Promise<unknown> {
  const { optionsSchema } = initialize
  if (!optionsSchema) {
    return pluginOptions
  }

  let result: StandardSchemaV1.Result<unknown>
  try {
    result = await optionsSchema['~standard'].validate(pluginOptions)
  } catch (error) {
    throw new PluginHostError(
      PluginHostErrorCode.InvalidPluginOptions,
      `Validate ${plugin.type} \`${plugin.key}\` options failed: ${(error as Error).message}`,
      {
        cause: error,
        details: {
          origin,
          pluginId: plugin.id,
          pluginKey: plugin.key,
          pluginPath: plugin.path,
          pluginType: plugin.type,
        },
      },
    )
  }

  if (result.issues) {
    const issueSummary = result.issues
      .map(issue => {
        const path = (issue.path || []).map(segment =>
          String(
            typeof segment === 'object' && segment !== null
              ? segment.key
              : segment,
          ),
        )
        const location = ['options', ...path].join('.')
        return `${location}: ${issue.message}`
      })
      .join('; ')

    throw new PluginHostError(
      PluginHostErrorCode.InvalidPluginOptions,
      `Invalid options for ${plugin.type} \`${plugin.key}\`${issueSummary ? `: ${issueSummary}` : '.'}`,
      {
        details: {
          issues: result.issues,
          origin,
          pluginId: plugin.id,
          pluginKey: plugin.key,
          pluginPath: plugin.path,
          pluginType: plugin.type,
        },
      },
    )
  }

  return result.value
}
