import type { Plugin } from '../plugin/plugin'

/**
 * 创建 {@link PluginHost} 实例所需的选项
 */
export interface PluginHostOptions {
  /**
   * 工作目录
   */
  cwd: string
  /**
   * 用于在插件或 Hook 边界停止后续工作的取消信号
   */
  signal?: AbortSignal
  /**
   * 预设声明集合
   */
  presets?: readonly PluginDeclaration[]
  /**
   * 插件声明集合
   */
  plugins?: readonly PluginDeclaration[]
  /**
   * 默认配置文件列表
   *
   * @example
   * ```ts
   * ['config.ts', 'config.js']
   * ```
   */
  defaultConfigFiles?: readonly string[]
  /**
   * 默认配置文件扩展名
   *
   * @example
   * `['dev', 'staging']` 会查找 `config.dev.ts` 和 `config.staging.ts`
   */
  defaultConfigExts?: readonly string[]
}

/**
 * 插件模块名或携带选项的插件声明元组
 *
 * @typeParam Options - 插件选项类型
 */
export type PluginDeclaration<Options = Record<string, unknown>> =
  string | readonly [string, Options]

/**
 * 插件声明的来源信息
 */
export interface PluginOrigin {
  /**
   * 声明来源
   */
  source: 'configuration' | 'preset-result' | 'plugin-api'
  /**
   * 原始插件声明
   */
  declaration?: string
  /**
   * 引入当前声明的父插件
   */
  parentPlugin?: {
    /**
     * 父插件 ID
     */
    id: string
    /**
     * 父插件 key
     */
    key: string
    /**
     * 父插件入口路径
     */
    path: string
    /**
     * 父插件类型
     */
    type: string
  }
}

/**
 * 解析后的插件实例、选项与可选来源元组
 *
 * @typeParam Options - 插件选项类型
 */
export type ResolvedPlugin<Options = Record<string, unknown>> = readonly [
  Plugin,
  Options | undefined,
  PluginOrigin?,
]

/**
 * 插件宿主读取的基础用户配置
 */
export interface UserConfig {
  /**
   * 预设定义集合
   */
  presets?: readonly PluginDeclaration[]
  /**
   * 插件定义集合
   */
  plugins?: readonly PluginDeclaration[]
}

/**
 * 插件宿主生命周期状态
 */
export enum PluginHostState {
  /**
   * 未初始化
   */
  Uninitialized = 'uninitialized',
  /**
   * 正在加载配置
   */
  LoadingConfig = 'loadingConfig',
  /**
   * 正在加载预设
   */
  LoadingPresets = 'loadingPresets',
  /**
   * 正在加载插件
   */
  LoadingPlugins = 'loadingPlugins',
  /**
   * 已就绪
   */
  Ready = 'ready',
  /**
   * 加载失败，不可重试
   */
  Failed = 'failed',
}

/**
 * Hook 聚合执行类型
 */
export enum HookKind {
  /**
   * 增加
   */
  Add = 'add',
  /**
   * 修改
   */
  Modify = 'modify',
  /**
   * 获取
   */
  Get = 'get',
  /**
   * 事件
   */
  Event = 'event',
}

/**
 * 未声明 Hook Schema 时执行 Hook 的宽松选项
 *
 * @typeParam Value - 初始值类型
 * @typeParam Args - Hook 参数类型
 */
export interface LooseHookRunOptions<Value, Args> {
  /**
   * Hook 聚合类型
   */
  kind?: HookKind
  /**
   * 初始化值
   */
  initialValue?: Value
  /**
   * 函数参数
   */
  args?: Args
}
