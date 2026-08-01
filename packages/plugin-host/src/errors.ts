/**
 * 插件系统的稳定错误码
 */
export enum PluginHostErrorCode {
  /**
   * 调用方主动取消插件宿主操作
   */
  OperationAborted = 'PLUGIN_HOST_OPERATION_ABORTED',
  /**
   * 构造或调用参数无效
   */
  InvalidOptions = 'PLUGIN_HOST_INVALID_OPTIONS',
  /**
   * 当前生命周期状态不允许执行目标操作
   */
  InvalidState = 'PLUGIN_HOST_INVALID_STATE',
  /**
   * 插件 API 名称冲突
   */
  ApiNameConflict = 'PLUGIN_HOST_API_NAME_CONFLICT',
  /**
   * 插件文件扩展名不受支持
   */
  UnsupportedPluginExtension = 'PLUGIN_HOST_UNSUPPORTED_PLUGIN_EXTENSION',
  /**
   * 插件无法被解析
   */
  PluginResolveFailed = 'PLUGIN_HOST_PLUGIN_RESOLVE_FAILED',
  /**
   * 插件声明格式或内容无效
   */
  InvalidPluginDeclaration = 'PLUGIN_HOST_INVALID_PLUGIN_DECLARATION',
  /**
   * 插件或 preset 声明参数未通过 Schema 校验
   */
  InvalidPluginOptions = 'PLUGIN_HOST_INVALID_PLUGIN_OPTIONS',
  /**
   * 插件 ID 或 key 重复
   */
  DuplicatePlugin = 'PLUGIN_HOST_DUPLICATE_PLUGIN',
  /**
   * 插件引用无效
   */
  InvalidPluginReference = 'PLUGIN_HOST_INVALID_PLUGIN_REFERENCE',
  /**
   * Hook 定义或调用无效
   */
  InvalidHook = 'PLUGIN_HOST_INVALID_HOOK',
  /**
   * 插件模块加载失败
   */
  PluginLoadFailed = 'PLUGIN_HOST_PLUGIN_LOAD_FAILED',
  /**
   * 插件模块没有导出入口函数
   */
  InvalidPluginExport = 'PLUGIN_HOST_INVALID_PLUGIN_EXPORT',
  /**
   * 插件初始化函数执行失败
   */
  PluginInitializationFailed = 'PLUGIN_HOST_PLUGIN_INITIALIZATION_FAILED',
  /**
   * Hook 启用条件执行失败
   */
  HookEnablementFailed = 'PLUGIN_HOST_HOOK_ENABLEMENT_FAILED',
  /**
   * Hook 处理函数执行失败
   */
  HookExecutionFailed = 'PLUGIN_HOST_HOOK_EXECUTION_FAILED',
  /**
   * 插件返回值不符合当前类型约束
   */
  InvalidPluginResult = 'PLUGIN_HOST_INVALID_PLUGIN_RESULT',
  /**
   * 插件入口路径无效
   */
  InvalidPluginPath = 'PLUGIN_HOST_INVALID_PLUGIN_PATH',
}

/**
 * 创建 {@link PluginHostError} 时可附加的错误信息
 */
export interface PluginHostErrorOptions extends ErrorOptions {
  /**
   * 便于程序化诊断的上下文
   */
  details?: Readonly<Record<string, unknown>>
}

/**
 * 插件系统抛出的领域错误
 *
 * @remarks
 * 调用方可以通过 `code` 属性做稳定的程序化判断，并通过 `details`
 * 属性获取与错误相关的结构化上下文
 */
export class PluginHostError extends Error {
  /**
   * 稳定错误码
   */
  public readonly code: PluginHostErrorCode
  /**
   * 错误上下文
   */
  public readonly details?: Readonly<Record<string, unknown>>

  /**
   * 创建插件系统领域错误
   *
   * @param code - 稳定错误码
   * @param message - 面向开发者的错误信息
   * @param options - 原始错误及结构化上下文
   */
  public constructor(
    code: PluginHostErrorCode,
    message: string,
    options?: PluginHostErrorOptions,
  ) {
    super(message, options)
    this.name = 'PluginHostError'
    this.code = code
    this.details = options?.details
  }
}
