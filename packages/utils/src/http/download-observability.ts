import { UtilsError } from '../error'
import { emitUtilsEvent } from '../observability/internal'
import type { DownloadOptions } from './download-options'

/**
 * 统一记录下载操作生命周期并归一化取消错误
 * @param operation - 监控操作名称
 * @param url - 资源地址
 * @param options - 下载选项
 * @param task - 实际下载任务
 * @returns 下载任务结果
 * @internal
 */
export async function observeDownload<T>(
  operation: string,
  url: string,
  options: DownloadOptions,
  task: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now()
  const parsedUrl = new URL(url)
  const attributes = {
    hostname: parsedUrl.hostname,
    protocol: parsedUrl.protocol,
  }

  emitUtilsEvent(options.runtime, {
    attributes,
    operation,
    phase: 'start',
    timestamp: startedAt,
  })

  try {
    const result = await task()
    emitUtilsEvent(options.runtime, {
      attributes,
      durationMs: Date.now() - startedAt,
      operation,
      phase: 'success',
      timestamp: Date.now(),
    })
    return result
  } catch (cause) {
    const error = isAbortError(cause)
      ? new UtilsError('ERR_OPERATION_ABORTED', 'Download was aborted', {
          cause,
          operation,
        })
      : cause

    emitUtilsEvent(options.runtime, {
      attributes,
      durationMs: Date.now() - startedAt,
      error,
      operation,
      phase: 'failure',
      timestamp: Date.now(),
    })
    throw error
  }
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || error.name === 'TimeoutError')
  )
}
