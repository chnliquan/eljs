import { ReleaseRunner } from './release-runner'
import type { Config } from './types'

/**
 * 发布 NPM 包
 *
 * @param version - 指定版本
 * @param options - 发布选项
 * @returns 发布流程结束后兑现的 Promise
 * @throws 当配置、项目检查、版本更新或外部发布操作失败时传播原始错误
 */
export async function release(
  version?: string,
  options?: Config,
): Promise<void> {
  return new ReleaseRunner(options).run(version)
}
