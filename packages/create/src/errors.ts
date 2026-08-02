/**
 * create 稳定错误码
 */
export type CreateErrorCode =
  | 'CREATE_ERROR'
  | 'CREATE_CLEANUP_FAILED'
  | 'CREATE_INVALID_OPTIONS'
  | 'CREATE_INVALID_PROJECT_NAME'
  | 'CREATE_INVALID_TEMPLATE'
  | 'CREATE_OPERATION_ABORTED'
  | 'CREATE_OPERATION_CANCELLED'
  | 'CREATE_RECOVERY_FAILED'
  | 'CREATE_TARGET_LOCKED'
  | 'CREATE_TEMPLATE_DOWNLOAD_FAILED'
  | 'CREATE_TEMPLATE_PREPARATION_FAILED'

/**
 * 创建 {@link AppError} 时附加的稳定诊断上下文
 */
export interface AppErrorOptions extends ErrorOptions {
  /** 可供调用方稳定分支处理的错误码 */
  code?: CreateErrorCode
  /** 不包含令牌等敏感信息的结构化诊断字段 */
  details?: Readonly<Record<string, unknown>>
}

/**
 * create 面向调用方的领域错误
 */
export class AppError extends Error {
  /** 稳定错误码 */
  public readonly code: CreateErrorCode
  /** 结构化诊断字段 */
  public readonly details?: Readonly<Record<string, unknown>>

  /**
   * 创建面向 create 调用方的应用错误
   *
   * @param message - 可直接展示给用户的错误信息
   * @param options - 原始失败原因等标准错误选项
   */
  public constructor(message: string, options: AppErrorOptions = {}) {
    super(message, options)
    this.name = 'AppError'
    this.code = options.code ?? 'CREATE_ERROR'
    this.details = options.details
  }
}
