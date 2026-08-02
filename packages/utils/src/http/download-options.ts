import type { Duplex } from 'node:stream'

/**
 * HTTP 下载操作的兼容返回值
 *
 * @remarks
 * 该对象既可作为 Promise 等待完整响应内容，也可作为双工流读取最终结果
 * 需要边下载边写入文件或解压时应优先使用 `downloadTo`
 */
export type DownloadResult = Promise<Buffer> & Duplex

/**
 * 下载资源时使用的选项
 */
export interface DownloadOptions {
  /** 是否将下载内容作为 tar 归档解压到目标目录 */
  extract?: boolean

  /**
   * 不解压时写入目标目录的文件名
   * @remarks 最终只使用文件名部分，避免通过相对路径写出目标目录
   */
  filename?: string

  /** HTTP 请求头 */
  headers?: Headers | Record<string, string> | Array<[string, string]>

  /**
   * Subresource Integrity 格式的预期内容摘要
   * @remarks 支持当前 Node.js 运行时提供的哈希算法，例如 npm 常用的 `sha512-<base64>`
   */
  integrity?: string

  /**
   * 允许接收的最大响应字节数，设置为 `0` 时不限制
   * @defaultValue 104857600
   */
  maxBytes?: number

  /** 解压归档时允许处理的最大条目数，设置为 `0` 时不限制 */
  maxEntries?: number

  /**
   * 解压归档时允许写出的最大总字节数，设置为 `0` 时不限制
   * @remarks 该限制与压缩包下载大小独立，用于阻止高压缩率归档耗尽磁盘
   */
  maxUnpackedBytes?: number

  /** HTTP(S) 代理地址 */
  proxy?: string

  /** 用于主动取消请求的信号 */
  signal?: AbortSignal

  /**
   * 解压时移除的归档路径层级数
   * @defaultValue 0
   */
  strip?: number

  /**
   * 请求超时时间，单位为毫秒，设置为 `0` 时不启用超时
   * @defaultValue 30000
   */
  timeout?: number
}
