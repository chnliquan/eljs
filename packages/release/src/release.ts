import { Runner } from './runner'
import type { Config } from './types'

/**
 * 发布
 * @param options 可选配置项
 * @param version 指定版本
 */
export async function release(version?: string, options?: Config) {
  return new Runner(options).run(version)
}
