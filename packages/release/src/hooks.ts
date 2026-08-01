import {
  defineEventHook,
  defineGetHook,
  defineHooks,
  defineModifyHook,
} from '@eljs/plugin-host'
import type { RequiredRecursive } from '@eljs/utils'
import type { ReleaseType } from 'semver'

import type { Config } from './types/config'
import type { AppData } from './types/runner'
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
 */
export const releaseHookSchema = defineHooks({
  modifyConfig: defineModifyHook<RequiredRecursive<Config>>(),
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
  readonly config: RequiredRecursive<Config>
  /**
   * 当前发布应用数据
   */
  readonly appData: AppData
  /**
   * 输出一条发布步骤日志
   *
   * @param message - 日志信息
   */
  step(message: string): void
}
