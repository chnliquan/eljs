import { run, type RunCommandOptions } from '@eljs/utils/cp'
import { compare as compareSemver, valid as isValidSemver } from 'semver'

/** 统一发布标签 `v<version>` 的版本捕获组 */
const UNIFIED_TAG_PATTERN = /^v(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)$/

/** 独立发布标签 `<package>@<version>` 的版本捕获组 */
const INDEPENDENT_TAG_PATTERN =
  /^@?[^\s@]+@(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)$/

/**
 * 判断 Git 标签是否指向当前提交
 *
 * @remarks
 * 标签不存在或 Git 命令执行失败时返回 `false`
 *
 * @param tagName - 待检查的 Git 标签
 * @param options - Git 命令执行选项
 * @returns 标签解析出的提交是否与 HEAD 相同
 * @throws 检查期间收到取消信号时抛出取消原因
 */
export async function isGitTagAtHead(
  tagName: string,
  options?: RunCommandOptions,
): Promise<boolean> {
  try {
    const tagCommit = await run(
      'git',
      ['rev-list', '-n', '1', tagName],
      options,
    )
    const headCommit = await run('git', ['rev-parse', 'HEAD'], options)

    return (
      tagCommit.stdout.trim().length > 0 &&
      tagCommit.stdout.trim() === headCommit.stdout.trim()
    )
  } catch (error) {
    if (options?.signal?.aborted) {
      throw options.signal.reason ?? error
    }

    return false
  }
}

/**
 * 从指向 HEAD 的发布标签中发现待重试的版本
 *
 * @remarks
 * 发布中断后本地 release 标签保留在 HEAD；重试时以标签携带的版本为目标，
 * 已发布包由 registry 事实驱动跳过。统一模式读取 `v<version>`，独立模式
 * 读取 `<package>@<version>`，多个命中时取语义化版本最大者
 *
 * @param cwd - Git 仓库工作目录
 * @param independent - 是否为独立标签模式
 * @param options - Git 命令执行选项
 * @returns 待重试的目标版本，无匹配发布标签时返回 `undefined`
 * @throws 检查期间收到取消信号时抛出取消原因
 */
export async function findRetryVersionAtHead(
  cwd: string,
  independent: boolean,
  options?: RunCommandOptions,
): Promise<string | undefined> {
  const { stdout } = await run('git', ['tag', '--points-at', 'HEAD'], {
    ...options,
    cwd,
  })

  const pattern = independent ? INDEPENDENT_TAG_PATTERN : UNIFIED_TAG_PATTERN
  let retryVersion: string | undefined

  for (const tagName of stdout.split('\n')) {
    const tag = tagName.trim()
    const match = tag.match(pattern)

    if (!match) {
      continue
    }

    const version = match[1]
    if (!isValidSemver(version)) {
      continue
    }

    // 取标签中的最大语义化版本作为重试目标，独立模式下多包版本应保持一致
    if (!retryVersion || compareSemver(version, retryVersion) > 0) {
      retryVersion = version
    }
  }

  return retryVersion
}
