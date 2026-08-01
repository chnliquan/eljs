/**
 * utils 日志级别
 */
export type UtilsLogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * 传给调用方日志适配器的结构化日志
 */
export interface UtilsLogEntry {
  /**
   * 不包含敏感信息的补充字段
   */
  attributes?: Readonly<Record<string, unknown>>

  /**
   * 日志级别
   */
  level: UtilsLogLevel

  /**
   * 日志文本
   */
  message: string

  /**
   * 产生日志的稳定操作名
   */
  operation: string
}

/**
 * utils 操作生命周期阶段
 */
export type UtilsOperationPhase = 'start' | 'success' | 'failure'

/**
 * 传给调用方监控适配器的操作事件
 */
export interface UtilsOperationEvent {
  /**
   * 不包含敏感信息的补充字段
   */
  attributes?: Readonly<Record<string, unknown>>

  /**
   * 已完成操作的耗时，单位为毫秒
   */
  durationMs?: number

  /**
   * 失败阶段的原始异常
   */
  error?: unknown

  /**
   * 稳定操作名
   */
  operation: string

  /**
   * 生命周期阶段
   */
  phase: UtilsOperationPhase

  /**
   * 事件发生时间的 Unix 毫秒时间戳
   */
  timestamp: number
}

/**
 * 接收结构化日志的适配器
 */
export type UtilsLogger = (entry: UtilsLogEntry) => void

/**
 * 接收操作生命周期事件的适配器
 */
export type UtilsObserver = (event: UtilsOperationEvent) => void

/**
 * 由调用方按运行环境注入的日志与监控适配器
 *
 * @remarks
 * 适配器异常会被 utils 隔离，不会改变原操作结果
 */
export interface UtilsRuntime {
  /**
   * 结构化日志适配器
   */
  logger?: UtilsLogger

  /**
   * 操作生命周期监控适配器
   */
  observer?: UtilsObserver
}
