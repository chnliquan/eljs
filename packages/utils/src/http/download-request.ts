import { ProxyAgent } from 'urllib'

import { UtilsError } from '../error'
import type { DownloadOptions } from './download-options'

/**
 * 验证协议、组合取消信号并发起下载请求
 * @param url - 资源地址
 * @param options - 下载选项
 * @returns 解析后的 URL 和成功响应
 * @throws URL 协议或 HTTP 状态不符合约束时抛出错误
 * @internal
 */
export async function requestDownload(
  url: string,
  options: DownloadOptions,
): Promise<{
  dispatcher?: ProxyAgent
  parsedUrl: URL
  response: Response
}> {
  const parsedUrl = new URL(url)

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new UtilsError(
      'ERR_DOWNLOAD_PROTOCOL',
      `Unsupported download protocol: ${parsedUrl.protocol}`,
      {
        details: { protocol: parsedUrl.protocol },
        operation: 'http.download',
      },
    )
  }

  const timeout = options.timeout ?? 30_000
  const signals = [
    options.signal,
    timeout > 0 ? AbortSignal.timeout(timeout) : undefined,
  ].filter((signal): signal is AbortSignal => Boolean(signal))
  const signal =
    signals.length > 1 ? AbortSignal.any(signals) : (signals.at(0) ?? undefined)
  const dispatcher = options.proxy ? new ProxyAgent(options.proxy) : undefined
  let response: Response

  try {
    response = await fetch(parsedUrl, {
      ...(dispatcher ? { dispatcher } : undefined),
      headers: options.headers,
      redirect: 'follow',
      signal,
    } as RequestInit)
  } catch (cause) {
    await closeFailedRequestDispatcher(dispatcher, cause)
    if (signal?.aborted) {
      throw cause
    }
    throw new UtilsError('ERR_DOWNLOAD_REQUEST', 'Download request failed', {
      cause,
      details: {
        hostname: parsedUrl.hostname,
        protocol: parsedUrl.protocol,
      },
      operation: 'http.download',
    })
  }

  if (!response.ok) {
    const error = new UtilsError(
      'ERR_DOWNLOAD_HTTP_STATUS',
      `Request failed with status ${response.status} ${response.statusText}`,
      {
        details: {
          status: response.status,
          statusText: response.statusText,
        },
        operation: 'http.download',
      },
    )
    await closeFailedRequestDispatcher(dispatcher, error)
    throw error
  }

  return { dispatcher, parsedUrl, response }
}

/**
 * 请求失败后关闭代理并保留请求错误与清理错误
 * @param dispatcher - 本次请求创建的代理调度器
 * @param requestError - 原始请求错误
 * @returns 代理关闭后结束
 * @throws 代理关闭也失败时抛出包含两个原因的 `AggregateError`
 * @internal
 */
async function closeFailedRequestDispatcher(
  dispatcher: ProxyAgent | undefined,
  requestError: unknown,
): Promise<void> {
  if (!dispatcher) {
    return
  }

  try {
    await dispatcher.close()
  } catch (cleanupError) {
    throw new AggregateError(
      [requestError, cleanupError],
      'Download request failed and proxy cleanup also failed',
      { cause: cleanupError },
    )
  }
}
