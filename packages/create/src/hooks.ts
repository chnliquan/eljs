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
  modifyTsConfig: defineModifyHook<Record<string, unknown>>(),
  modifyJestConfig: defineModifyHook<Record<string, unknown>>(),
  modifyPrettierConfig: defineModifyHook<Record<string, unknown>>(),
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
   */
  readonly appData: AppData
  /**
   * 已解析的项目路径
   */
  readonly paths: Required<Paths>
  /**
   * 用户交互输入
   */
  readonly prompts: Prompts
  /**
   * 当前 TypeScript 配置
   */
  readonly tsConfig: Record<string, unknown>
  /**
   * 当前 Jest 配置
   */
  readonly jestConfig: Record<string, unknown>
  /**
   * 当前 Prettier 配置
   */
  readonly prettierConfig: Record<string, unknown>
}
