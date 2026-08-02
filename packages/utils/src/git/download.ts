import path from 'node:path'

import { run } from '../cp'
import { createTempDir, mkdir, remove } from '../file'

/**
 * 下载选项
 */
export interface CloneGitRepositoryOptions {
  /**
   * 要检出的分支或标签
   *
   * @remarks
   * 显式值优先于仓库地址末尾的 `#ref` 片段；未指定时使用远端默认分支
   */
  branch?: string
  /**
   * 目标路径
   */
  dest?: string
  /**
   * 用于终止 Git 子进程的取消信号
   */
  signal?: AbortSignal
}

/**
 * 克隆 Git 仓库
 * @param url - Git 地址
 * @param options - 选项
 * @returns 克隆后的 package 目录
 * @throws 克隆或临时目录清理失败时抛出错误
 */
export async function cloneGitRepository(
  url: string,
  options?: CloneGitRepositoryOptions,
): Promise<string> {
  const ownsDestination = !options?.dest
  const {
    branch: explicitBranch,
    dest = await createTempDir(true),
    signal,
  } = options || {}
  const { repositoryUrl, branch: fragmentBranch } = parseGitCloneSource(url)
  const branch = explicitBranch ?? fragmentBranch

  const args = ['clone', '--quiet', '--depth', '1']
  if (branch) {
    args.push('--branch', branch)
  }
  args.push(repositoryUrl, 'package')

  try {
    await mkdir(dest)
    await run('git', args, {
      cwd: dest,
      signal,
    })
  } catch (error) {
    if (ownsDestination) {
      try {
        await remove(dest)
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          `Download ${url} failed and temporary directory cleanup also failed`,
          { cause: cleanupError },
        )
      }
    }

    const err = error as Error
    err.message = `Download ${url} failed: ${err.message}.`
    throw err
  }

  return path.join(dest, 'package')
}

/**
 * 将 npm 风格的 Git 地址转换为 `git clone` 可接受的仓库地址和可选 ref
 *
 * @remarks
 * `git+https` 等前缀只用于包管理器声明，原生 Git 不接受该协议名；URL
 * 片段约定为待检出的分支或标签，不能继续传给远端服务器
 *
 * @param source - 用户提供的 Git 模板地址
 * @returns 规范化仓库地址和地址片段声明的分支或标签
 */
function parseGitCloneSource(source: string): {
  repositoryUrl: string
  branch?: string
} {
  const hashIndex = source.lastIndexOf('#')
  const fragment = hashIndex >= 0 ? source.slice(hashIndex + 1).trim() : ''
  const sourceWithoutFragment =
    hashIndex >= 0 ? source.slice(0, hashIndex) : source
  const repositoryUrl = sourceWithoutFragment.replace(
    /^git\+(?=https?:|ssh:)/u,
    '',
  )

  return {
    repositoryUrl,
    ...(fragment ? { branch: decodeURIComponent(fragment) } : {}),
  }
}
