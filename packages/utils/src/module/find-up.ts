import {
  findUp as findUpDependency,
  findUpStop,
  findUpSync as findUpSyncDependency,
  type Match,
  type Options,
} from 'find-up'

import { pathExists, pathExistsSync } from '../file/is'

type AsyncMatcher = (directory: string) => Match | Promise<Match>
type SyncMatcher = (directory: string) => Match

function findUpCompat(
  name: string | readonly string[],
  options?: Options,
): Promise<string | undefined>
function findUpCompat(
  matcher: AsyncMatcher,
  options?: Options,
): Promise<string | undefined>
function findUpCompat(
  target: string | readonly string[] | AsyncMatcher,
  options?: Options,
): Promise<string | undefined> {
  return findUpDependency(target as AsyncMatcher, options)
}

function findUpSyncCompat(
  name: string | readonly string[],
  options?: Options,
): string | undefined
function findUpSyncCompat(
  matcher: SyncMatcher,
  options?: Options,
): string | undefined
function findUpSyncCompat(
  target: string | readonly string[] | SyncMatcher,
  options?: Options,
): string | undefined {
  return findUpSyncDependency(target as SyncMatcher, options)
}

const findUpSync = Object.assign(findUpSyncCompat, {
  exists: pathExistsSync,
})

/**
 * 从指定目录向上查找文件或目录
 *
 * @remarks
 * 保留历史 `sync`、`exists` 和 `stop` 扩展点，同时使用 `find-up` 当前命名 API
 */
export const findUp = Object.assign(findUpCompat, {
  exists: pathExists,
  stop: findUpStop,
  sync: findUpSync,
})
