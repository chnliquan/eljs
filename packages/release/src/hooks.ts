import {
  defineEventHook,
  defineGetHook,
  defineHooks,
  defineModifyHook,
} from '@eljs/plugin-host'
import type { ReleaseType } from 'semver'

import type { ResolvedConfig } from './types/config'
import type { AppData, ReleaseErrorContext } from './types/runner'
import type { parseVersion } from './utils/version'

/**
 * 解析后的语义化版本信息
 */
type ParsedVersion = ReturnType<typeof parseVersion>

/**
 * 发布阶段共享的版本和变更日志上下文
 */
type ReleaseContext = ParsedVersion & { changelog: string }

/**
 * ReleaseRunner 的 Hook 单一契约
 *
 * @remarks
 * 正常生命周期依次执行 `modifyConfig`、`modifyAppData`、`onCheck`、
 * `onStart`、版本计算与更新 Hook、`getChangelog`，最后执行三个发布 Hook
 * 插件加载完成后的任一阶段失败会触发 `onError`
 * 插件加载前的失败无法调用尚未注册的 Hook，其自身失败只记录警告且不会替换原始错误
 */
export const releaseHookSchema = defineHooks({
  modifyConfig: defineModifyHook<ResolvedConfig>(),
  modifyAppData: defineModifyHook<AppData, { cwd: string }>(),
  onCheck: defineEventHook<{
    releaseTypeOrVersion?: ReleaseType | string
  }>(),
  onStart: defineEventHook(),
  getIncrementVersion: defineGetHook<
    { releaseTypeOrVersion?: ReleaseType | string },
    string
  >(),
  onBeforeBumpVersion: defineEventHook<ParsedVersion>(),
  onBumpVersion: defineEventHook<ParsedVersion>(),
  onAfterBumpVersion: defineEventHook<ParsedVersion>(),
  getChangelog: defineGetHook<ParsedVersion, string>(),
  onBeforeRelease: defineEventHook<ReleaseContext>(),
  onRelease: defineEventHook<ReleaseContext>(),
  onAfterRelease: defineEventHook<ReleaseContext>(),
  onError: defineEventHook<ReleaseErrorContext>(),
})

/**
 * ReleaseRunner 插件显式可访问的运行时能力
 */
export interface ReleasePluginCapabilities {
  /**
   * 最终 release 配置
   *
   * @remarks
   * 插件初始化及 `modifyConfig` Hook 执行期间不可读取
   * `modifyConfig` Hook 应使用其入参访问当前配置
   */
  readonly config: ResolvedConfig
  /**
   * 当前发布应用数据
   *
   * @remarks
   * 插件初始化及 `modifyAppData` Hook 执行期间不可读取；Hook 应使用其 `memo` 入参
   */
  readonly appData: AppData
  /**
   * 输出一条发布步骤日志
   *
   * @param message - 日志信息
   */
  step(message: string): void
}
