import {
  defineAddHook,
  defineEventHook,
  defineHooks,
  defineModifyHook,
} from '@eljs/plugin-host'
import type { prompts } from '@eljs/utils/cli'

import type { ResolvedConfig } from './types/config'
import type { AppData, Paths, Prompts } from './types/runner'

/**
 * CreateRunner 的 Hook 单一契约
 */
export const createHookSchema = defineHooks({
  addQuestions: defineAddHook<{ cwd: string }, prompts.PromptObject[]>(),
  modifyPaths: defineModifyHook<Paths, { cwd: string }>(),
  modifyAppData: defineModifyHook<AppData, { cwd: string }>(),
  modifyPrompts: defineModifyHook<
    Prompts,
    { questions: prompts.PromptObject[] }
  >(),
  onStart: defineEventHook(),
  onBeforeGenerateFiles: defineEventHook<{
    prompts: Prompts
    paths: Paths
  }>(),
  onGenerateFiles: defineEventHook<{
    prompts: Prompts
    paths: Paths
  }>(),
  onGenerateDone: defineEventHook(),
})

/**
 * CreateRunner 插件显式可访问的运行时能力
 */
export interface CreatePluginCapabilities {
  /**
   * 最终 create 配置
   *
   * @remarks
   * 仅在插件初始化完成且配置解析后可读取
   */
  readonly config: ResolvedConfig
  /**
   * 当前应用数据
   *
   * @remarks
   * 插件初始化及 `modifyAppData` Hook 执行期间不可读取；Hook 应使用其 `memo` 入参
   */
  readonly appData: AppData
  /**
   * 已解析的项目路径
   *
   * @remarks
   * 插件初始化及 `modifyPaths` Hook 执行期间不可读取；Hook 应使用其 `memo` 入参
   */
  readonly paths: Required<Paths>
  /**
   * 用户交互输入
   *
   * @remarks
   * 插件初始化及 `modifyPrompts` Hook 执行期间不可读取；Hook 应使用其 `memo` 入参
   */
  readonly prompts: Prompts
}
