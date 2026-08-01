/**
 * utils 公共错误码
 */
export type UtilsErrorCode =
  | 'ERR_ARCHIVE_TOO_LARGE'
  | 'ERR_ARCHIVE_TOO_MANY_ENTRIES'
  | 'ERR_DOWNLOAD_HTTP_STATUS'
  | 'ERR_DOWNLOAD_INTEGRITY'
  | 'ERR_DOWNLOAD_PROTOCOL'
  | 'ERR_DOWNLOAD_REQUEST'
  | 'ERR_DOWNLOAD_TOO_LARGE'
  | 'ERR_EXECUTABLE_NOT_FOUND'
  | 'ERR_NPM_REGISTRY_HTTP_STATUS'
  | 'ERR_NPM_REGISTRY_REQUEST'
  | 'ERR_NPM_REGISTRY_RESPONSE'
  | 'ERR_OPERATION_ABORTED'
  | 'ERR_PROCESS_EXIT'
  | 'ERR_PROCESS_SPAWN'
  | 'ERR_UNSUPPORTED_PLATFORM'

/**
 * 构造 {@link UtilsError} 时使用的上下文
 */
export interface UtilsErrorOptions {
  /**
   * 原始异常
   */
  cause?: unknown

  /**
   * 不包含密码、令牌等敏感信息的诊断字段
   */
  details?: Readonly<Record<string, unknown>>

  /**
   * 发生错误的稳定操作名
   */
  operation?: string
}

/**
 * 带稳定错误码和操作上下文的 utils 错误
 */
export class UtilsError extends Error {
  /**
   * 可供调用方分支处理的稳定错误码
   */
  public readonly code: UtilsErrorCode

  /**
   * 不包含敏感信息的诊断字段
   */
  public readonly details?: Readonly<Record<string, unknown>>

  /**
   * 发生错误的稳定操作名
   */
  public readonly operation?: string

  /**
   * @param code - 稳定错误码
   * @param message - 面向开发者的错误信息
   * @param options - 原始异常和诊断上下文
   */
  public constructor(
    code: UtilsErrorCode,
    message: string,
    options: UtilsErrorOptions = {},
  ) {
    super(message, { cause: options.cause })
    this.name = 'UtilsError'
    this.code = code
    this.details = options.details
    this.operation = options.operation
  }
}
