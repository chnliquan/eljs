import { ProxyAgent } from 'urllib'

import { UtilsError } from '../error'
import type { DownloadOptions } from './download-options'

/**
 * 验证每跳协议并使用同一取消信号和代理发起下载请求
 * @remarks 跨 origin 仅转发固定的非凭证头，取消中间或失败响应体后才关闭代理
 * @param url - 资源地址
 * @param options - 下载选项
 * @returns 解析后的 URL 和成功响应
 * @throws 协议、重定向或 HTTP 状态不符合约束时抛出错误，清理失败时保留聚合原因
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

  const maxRedirects = options.maxRedirects ?? 20
  if (!Number.isSafeInteger(maxRedirects) || maxRedirects < 0) {
    throw new RangeError('maxRedirects must be a non-negative safe integer')
  }
  const timeout = options.timeout ?? 30_000
  const signals = [
    options.signal,
    timeout > 0 ? AbortSignal.timeout(timeout) : undefined,
  ].filter((signal): signal is AbortSignal => Boolean(signal))
  const signal =
    signals.length > 1 ? AbortSignal.any(signals) : (signals.at(0) ?? undefined)
  const dispatcher = options.proxy ? new ProxyAgent(options.proxy) : undefined
  let response: Response | undefined
  let currentUrl = parsedUrl
  let headers = options.headers
  let transportFailed = false

  try {
    for (let redirects = 0; ; redirects++) {
      try {
        response = await fetch(currentUrl, {
          ...(dispatcher ? { dispatcher } : undefined),
          headers,
          redirect: 'manual',
          signal,
        } as RequestInit)
      } catch (cause) {
        transportFailed = true
        throw cause
      }

      const location = response.headers.get('location')
      if (
        [301, 302, 303, 307, 308].includes(response.status) &&
        location !== null
      ) {
        if (redirects >= maxRedirects) {
          throw redirectError('Download redirect limit exceeded')
        }
        let nextUrl: URL
        try {
          nextUrl = new URL(location, currentUrl)
        } catch {
          throw redirectError('Invalid download redirect URL')
        }
        if (
          !['http:', 'https:'].includes(nextUrl.protocol) ||
          nextUrl.username ||
          nextUrl.password
        ) {
          throw redirectError('Unsupported download redirect URL')
        }
        if (
          currentUrl.protocol === 'https:' &&
          nextUrl.protocol === 'http:' &&
          !options.allowInsecureRedirects
        ) {
          throw redirectError('HTTPS to HTTP download redirect is disabled')
        }
        if (nextUrl.origin !== currentUrl.origin) {
          const safeHeaders = new Headers()
          new Headers(headers).forEach((value, name) => {
            if (
              [
                'accept',
                'accept-encoding',
                'accept-language',
                'user-agent',
                'range',
              ].includes(name)
            ) {
              safeHeaders.set(name, value)
            }
          })
          headers = safeHeaders
        }
        // 中间响应可能永不结束，取消后才能复用代理并进入下一跳
        await response.body?.cancel()
        response = undefined
        currentUrl = nextUrl
        continue
      }
      if (!response.ok) {
        throw new UtilsError(
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
      }

      return { dispatcher, parsedUrl: currentUrl, response }
    }
  } catch (error) {
    await closeFailedRequestDispatcher(dispatcher, error, response)
    if (transportFailed && !signal?.aborted) {
      throw new UtilsError('ERR_DOWNLOAD_REQUEST', 'Download request failed', {
        cause: error,
        details: {
          hostname: currentUrl.hostname,
          protocol: currentUrl.protocol,
        },
        operation: 'http.download',
      })
    }
    throw error
  }
}

/**
 * 请求失败后先取消响应体再关闭代理，保留所有独立清理错误
 * @param dispatcher - 本次请求创建的代理调度器
 * @param requestError - 原始请求错误
 * @param response - 已收到但不会消费的响应
 * @returns 响应取消和代理关闭后结束
 * @throws 清理也失败时抛出包含请求错误与清理原因的 `AggregateError`
 * @internal
 */
async function closeFailedRequestDispatcher(
  dispatcher: ProxyAgent | undefined,
  requestError: unknown,
  response?: Response,
): Promise<void> {
  const cleanupErrors: unknown[] = []
  try {
    await response?.body?.cancel(requestError)
  } catch (error) {
    if (error !== requestError) {
      cleanupErrors.push(error)
    }
  }
  try {
    await dispatcher?.close()
  } catch (cleanupError) {
    cleanupErrors.push(cleanupError)
  }
  if (cleanupErrors.length) {
    throw new AggregateError(
      [requestError, ...cleanupErrors],
      'Download request failed and response cleanup also failed',
      { cause: cleanupErrors.at(-1) },
    )
  }
}

function redirectError(message: string): UtilsError {
  return new UtilsError('ERR_DOWNLOAD_REDIRECT', message, {
    operation: 'http.download',
  })
}
