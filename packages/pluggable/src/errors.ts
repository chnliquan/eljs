/**
 * 可插拔系统错误码
 */
export enum PluggableErrorCode {
  /**
   * 当前生命周期状态不允许执行目标操作
   */
  InvalidState = 'PLUGGABLE_INVALID_STATE',
  /**
   * 插件 API 名称冲突
   */
  ApiNameConflict = 'PLUGGABLE_API_NAME_CONFLICT',
  /**
   * 插件文件扩展名不受支持
   */
  UnsupportedPluginExtension = 'PLUGGABLE_UNSUPPORTED_PLUGIN_EXTENSION',
  /**
   * 插件无法被解析
   */
  PluginResolveFailed = 'PLUGGABLE_PLUGIN_RESOLVE_FAILED',
}

/**
 * 可插拔系统领域错误
 */
export class PluggableError extends Error {
  /**
   * 稳定错误码
   */
  public readonly code: PluggableErrorCode

  public constructor(
    code: PluggableErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'PluggableError'
    this.code = code
  }
}
