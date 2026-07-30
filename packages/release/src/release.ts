import { Runner } from './runner.js'
import type { Config } from './types/index.js'

/**
 * 发布 NPM 包
 * @param options 选项
 * @param version 指定版本
 */
export async function release(version?: string, options?: Config) {
  return new Runner(options).run(version)
}
