import { execa } from 'execa'

import { hasGlobalInstallation } from '../env'

/**
 * 检查项目 Git 状态时使用的选项
 */
export interface HasProjectGitOptions {
  /** 用于终止 Git 状态检查的取消信号 */
  signal?: AbortSignal
}

/**
 * 全局是否存在 git
 */
export async function hasGit(): Promise<boolean> {
  return hasGlobalInstallation('git')
}

/**
 * 项目是否存在 git
 * @param cwd - 当前工作目录
 * @param options - 状态检查选项
 * @returns 当前目录是否属于 Git 工作区
 * @throws 检查期间收到取消信号时抛出原始取消异常
 */
export async function hasProjectGit(
  cwd: string,
  options?: HasProjectGitOptions,
): Promise<boolean> {
  const child = execa('git', ['status'], {
    cwd,
  })
  const abortChild = () => child.kill('SIGTERM')
  options?.signal?.addEventListener('abort', abortChild, { once: true })

  if (options?.signal?.aborted) {
    abortChild()
  }

  try {
    const data = await child
    return Boolean(data.stdout)
  } catch (error) {
    if (options?.signal?.aborted) {
      throw options.signal.reason ?? error
    }

    return false
  } finally {
    options?.signal?.removeEventListener('abort', abortChild)
  }
}
