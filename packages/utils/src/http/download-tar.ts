import { x as extractTar, type Unpack } from 'tar'

import { UtilsError } from '../error'
import type { DownloadOptions } from './download-options'

/**
 * 创建带条目数限制与路径保护的 tar 解压器
 * @remarks 超限通过解压器的 abort/error 通道报告，使 pipeline 拒绝并触发清理
 * @param destination - 解压目标目录
 * @param options - 下载选项
 * @returns tar 解压流
 * @internal
 */
export function createTarExtractor(
  destination: string,
  options: DownloadOptions,
): Unpack {
  const maxEntries = options.maxEntries
  const maxUnpackedBytes = options.maxUnpackedBytes

  if (
    maxEntries !== undefined &&
    (!Number.isSafeInteger(maxEntries) || maxEntries < 0)
  ) {
    throw new RangeError('maxEntries must be a non-negative safe integer')
  }

  if (
    maxUnpackedBytes !== undefined &&
    (!Number.isSafeInteger(maxUnpackedBytes) || maxUnpackedBytes < 0)
  ) {
    throw new RangeError('maxUnpackedBytes must be a non-negative safe integer')
  }

  let entryCount = 0
  let unpackedBytes = 0

  const extractor = extractTar({
    cwd: destination,
    ...(maxEntries === undefined && maxUnpackedBytes === undefined
      ? {}
      : {
          filter: (_entryPath, entry) => {
            entryCount += 1

            if (maxEntries && entryCount > maxEntries) {
              extractor.abort(
                new UtilsError(
                  'ERR_ARCHIVE_TOO_MANY_ENTRIES',
                  `Archive contains more than ${maxEntries} entries`,
                  {
                    details: { maxEntries },
                    operation: 'http.download',
                  },
                ),
              )
              return false
            }

            const entrySize = Number(entry.size ?? 0)
            if (Number.isFinite(entrySize) && entrySize > 0) {
              unpackedBytes += entrySize
            }

            if (maxUnpackedBytes && unpackedBytes > maxUnpackedBytes) {
              extractor.abort(
                new UtilsError(
                  'ERR_ARCHIVE_TOO_LARGE',
                  `Archive expands beyond the ${maxUnpackedBytes} byte limit`,
                  {
                    details: { maxUnpackedBytes, unpackedBytes },
                    operation: 'http.download',
                  },
                ),
              )
              return false
            }

            return true
          },
        }),
    preservePaths: false,
    strict: true,
    strip: options.strip ?? 0,
  }) as Unpack

  return extractor
}
