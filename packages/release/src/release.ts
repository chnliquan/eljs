import { Runner } from './runner'
import type { InternalConfig } from './types'

/**
 * 发布 NPM 包
 * @param options 可选配置项
 * @param version 指定版本
 */
export async function release(version?: string, options?: InternalConfig) {
  return new Runner(options).run(version)
}
