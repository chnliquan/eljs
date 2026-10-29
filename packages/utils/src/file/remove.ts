import {
  rimraf,
  rimrafSync,
  type RimrafAsyncOptions,
  type RimrafSyncOptions,
} from 'rimraf'

/**
 * 异步删除文件（夹）
 * @param path - 文件路径
 * @param options - rimraf 异步选项，支持异步过滤器、取消信号和 glob
 * @returns 全部删除或路径不存在时为 `true`，过滤器保留路径时为 `false`
 * @remarks 省略选项时沿用 rimraf 默认行为，选项原样转发
 * @throws 原样传播 rimraf 的删除或取消错误
 */
export function remove(
  path: string,
  options?: RimrafAsyncOptions,
): Promise<boolean> {
  return rimraf(path, options)
}

/**
 * 同步删除文件（夹）
 * @param path - 文件路径
 * @param options - rimraf 同步选项，过滤器必须同步返回，支持取消信号和 glob
 * @returns 全部删除或路径不存在时为 `true`，过滤器保留路径时为 `false`
 * @remarks 省略选项时沿用 rimraf 默认行为，选项原样转发
 * @throws 原样传播 rimraf 的删除或取消错误
 */
export function removeSync(path: string, options?: RimrafSyncOptions): boolean {
  return rimrafSync(path, options)
}
