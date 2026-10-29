import { run, type RunCommandOptions } from '@eljs/utils/cp'
import { valid as isValidSemver } from 'semver'

import { AppError } from './error'

/** 统一发布标签 `v<version>` 的版本捕获组 */
const UNIFIED_TAG_PATTERN = /^v(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)$/

/** 独立发布标签 `<package>@<version>` 的版本捕获组 */
const INDEPENDENT_TAG_PATTERN =
  /^@?[^\s@]+@(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)$/

/**
 * 判断 Git 标签是否指向当前提交
 *
 * @remarks
 * 标签不存在、Git 命令执行失败或输出不是字符串时返回 `false`
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

    if (
      typeof tagCommit.stdout !== 'string' ||
      typeof headCommit.stdout !== 'string'
    ) {
      throw new TypeError('Git commit output must be text')
    }

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
 * 读取 `<package>@<version>`，匹配标签必须携带唯一版本
 * 独立模式允许只有部分包标签存在，调用方仍须校验包版本和已发布冲突
 * 未指定包名过滤时保持原有标签匹配集合
 *
 * @param cwd - Git 仓库工作目录
 * @param independent - 是否为独立标签模式
 * @param options - Git 命令执行选项
 * @param packageNames - 独立模式下允许的包名，省略时不限制包名
 * @returns 待重试的目标版本，无匹配发布标签时返回 `undefined`
 * @throws Git 命令执行失败时抛出原始错误，标签输出不是字符串时抛出 `TypeError`
 * @throws {@link AppError} 匹配标签包含多个不同版本时抛出，要求调用方明确重试目标
 */
export async function findRetryVersionAtHead(
  cwd: string,
  independent: boolean,
  options?: RunCommandOptions,
  packageNames?: readonly string[],
): Promise<string | undefined> {
  const { stdout } = await run('git', ['tag', '--points-at', 'HEAD'], {
    ...options,
    cwd,
  })

  if (typeof stdout !== 'string') {
    throw new TypeError('Git tag output must be text')
  }

  const pattern = independent ? INDEPENDENT_TAG_PATTERN : UNIFIED_TAG_PATTERN
  let retryVersion: string | undefined

  for (const tagName of stdout.split('\n')) {
    const tag = tagName.trim()
    const match = tag.match(pattern)

    if (!match) {
      continue
    }

    if (
      independent &&
      packageNames &&
      !packageNames.includes(tag.slice(0, tag.lastIndexOf('@')))
    ) {
      continue
    }

    const version = match[1]
    if (!isValidSemver(version)) {
      continue
    }

    if (retryVersion && retryVersion !== version) {
      throw new AppError(
        'Ambiguous release tags at HEAD: matched tags contain different versions. Specify an exact retry version.',
      )
    }
    retryVersion = version
  }

  return retryVersion
}
