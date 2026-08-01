/**
 * 配置加载失败的稳定错误码
 */
export enum ConfigErrorCode {
  /** 配置路径存在但当前进程无法访问 */
  FileAccessFailed = 'CONFIG_FILE_ACCESS_FAILED',
  /** 配置文件内容不是对象 */
  InvalidConfig = 'CONFIG_INVALID_CONFIG',
  /** 已知格式的配置文件执行或解析失败 */
  LoadFailed = 'CONFIG_LOAD_FAILED',
  /** 自定义合并函数执行失败或返回无效结果 */
  MergeFailed = 'CONFIG_MERGE_FAILED',
  /** 同步 API 无法加载仅支持异步导入的格式 */
  SyncFormatUnsupported = 'CONFIG_SYNC_FORMAT_UNSUPPORTED',
  /** 文件扩展名没有对应加载器 */
  UnsupportedFormat = 'CONFIG_UNSUPPORTED_FORMAT',
  /** 最终配置未通过调用方验证 */
  ValidationFailed = 'CONFIG_VALIDATION_FAILED',
}

/**
 * 构造配置加载错误所需的上下文
 */
export interface ConfigLoadErrorOptions {
  /** 稳定错误码 */
  code: ConfigErrorCode
  /** 失败配置文件的绝对或调用方原始路径 */
  configFile: string
  /** 原始异常 */
  cause?: unknown
  /** 包含开头点号的文件扩展名 */
  format?: string
}

/**
 * 包含失败文件、格式与稳定错误码的配置加载错误
 *
 * @remarks
 * `message` 面向人工诊断，程序分支应使用 `code`，底层异常通过 `cause` 保留
 */
export class ConfigLoadError extends Error {
  /** 稳定错误码 */
  public readonly code: ConfigErrorCode
  /** 失败配置文件路径 */
  public readonly configFile: string
  /** 包含开头点号的文件扩展名 */
  public readonly format?: string

  /**
   * 创建配置加载错误
   *
   * @param message - 面向调用方的诊断消息
   * @param options - 错误码、文件路径、格式与原始异常
   */
  public constructor(message: string, options: ConfigLoadErrorOptions) {
    super(message, { cause: options.cause })
    this.name = 'ConfigLoadError'
    this.code = options.code
    this.configFile = options.configFile
    this.format = options.format
  }
}
