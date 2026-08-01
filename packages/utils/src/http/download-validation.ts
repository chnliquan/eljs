import { createHash, getHashes } from 'node:crypto'
import { Transform } from 'node:stream'

import { UtilsError } from '../error'

const DEFAULT_MAX_BYTES = 100 * 1024 * 1024

/**
 * 创建在数据流中持续检查响应大小的转换流
 * @param maxBytes - 最大响应字节数
 * @param url - 资源地址
 * @returns 原样传递数据并校验大小的转换流
 * @internal
 */
export function createSizeLimiter(maxBytes: number, url: string): Transform {
  let receivedBytes = 0

  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      receivedBytes += chunk.byteLength

      try {
        assertDownloadedSize(receivedBytes, maxBytes, url)
        callback(null, chunk)
      } catch (error) {
        callback(error as Error)
      }
    },
  })
}

/**
 * 创建在流结束时校验内容摘要的转换流
 * @param integrity - SRI 格式的预期内容摘要
 * @returns 原样传递数据并在结束时校验摘要的转换流
 * @internal
 */
export function createIntegrityVerifier(
  integrity: string | undefined,
): Transform {
  const checks = parseIntegrity(integrity)
  const hashes = checks.map(check => createHash(check.algorithm))

  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      for (const hash of hashes) {
        hash.update(chunk)
      }

      callback(null, chunk)
    },
    flush(callback) {
      if (
        !checks.length ||
        checks.some((check, index) => {
          return hashes[index].digest('base64') === check.digest
        })
      ) {
        callback()
        return
      }

      callback(
        new UtilsError(
          'ERR_DOWNLOAD_INTEGRITY',
          'Downloaded content failed integrity verification',
          { operation: 'http.download' },
        ),
      )
    },
  })
}

/**
 * 校验内存中的完整响应内容摘要
 * @param data - 完整响应内容
 * @param integrity - SRI 格式的预期内容摘要
 * @internal
 */
export function assertIntegrity(
  data: Buffer,
  integrity: string | undefined,
): void {
  const checks = parseIntegrity(integrity)

  if (
    checks.length &&
    !checks.some(check => {
      return (
        createHash(check.algorithm).update(data).digest('base64') ===
        check.digest
      )
    })
  ) {
    throw new UtilsError(
      'ERR_DOWNLOAD_INTEGRITY',
      'Downloaded content failed integrity verification',
      { operation: 'http.download' },
    )
  }
}

/**
 * 解析和验证最大响应大小
 * @param maxBytes - 调用方提供的最大响应字节数
 * @returns 有效的最大响应字节数
 * @internal
 */
export function resolveMaxBytes(maxBytes: number | undefined): number {
  const resolved = maxBytes ?? DEFAULT_MAX_BYTES

  if (!Number.isSafeInteger(resolved) || resolved < 0) {
    throw new RangeError('maxBytes must be a non-negative safe integer')
  }

  return resolved
}

/**
 * 在读取响应体前校验服务端声明的内容长度
 * @param response - HTTP 响应
 * @param maxBytes - 最大响应字节数
 * @param url - 资源地址
 * @internal
 */
export function assertContentLength(
  response: Response,
  maxBytes: number,
  url: string,
): void {
  const contentLength = response.headers?.get('content-length')

  if (!contentLength) {
    return
  }

  const declaredBytes = Number(contentLength)

  if (Number.isFinite(declaredBytes)) {
    assertDownloadedSize(declaredBytes, maxBytes, url)
  }
}

/**
 * 校验已经接收的响应大小
 * @param receivedBytes - 已接收的响应字节数
 * @param maxBytes - 最大响应字节数
 * @param url - 资源地址
 * @internal
 */
export function assertDownloadedSize(
  receivedBytes: number,
  maxBytes: number,
  url: string,
): void {
  if (maxBytes === 0 || receivedBytes <= maxBytes) {
    return
  }

  throw new UtilsError(
    'ERR_DOWNLOAD_TOO_LARGE',
    `Download exceeds the ${maxBytes} byte limit`,
    {
      details: { maxBytes, receivedBytes, url: new URL(url).origin },
      operation: 'http.download',
    },
  )
}

/**
 * 解析并筛选当前运行时支持的 SRI 摘要
 * @param integrity - SRI 格式摘要
 * @returns 受支持的算法和摘要列表
 * @internal
 */
function parseIntegrity(
  integrity: string | undefined,
): Array<{ algorithm: string; digest: string }> {
  if (!integrity) {
    return []
  }

  const supportedAlgorithms = new Set(getHashes())
  const checks = integrity
    .trim()
    .split(/\s+/u)
    .map(value => {
      const separatorIndex = value.indexOf('-')
      return {
        algorithm: value.slice(0, separatorIndex).toLowerCase(),
        digest: value.slice(separatorIndex + 1),
      }
    })
    .filter(
      check =>
        Boolean(check.algorithm && check.digest) &&
        supportedAlgorithms.has(check.algorithm),
    )

  if (!checks.length) {
    throw new UtilsError(
      'ERR_DOWNLOAD_INTEGRITY',
      'Integrity value does not contain a supported hash',
      { operation: 'http.download' },
    )
  }

  return checks
}
