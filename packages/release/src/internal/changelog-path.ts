import { resolveWriteDestination } from '@eljs/utils/file'
import { execFile } from 'node:child_process'
import { realpath } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execute = promisify(execFile)

/**
 * 校验更新日志写入边界并排除 Git 元数据
 *
 * @remarks
 * 允许工作目录内的普通子路径，拒绝越界、任意 `.git` 段和子路径符号链接
 * 通过只读 Git 查询同时排除实际 gitdir 和公共 gitdir，兼容 linked worktree 与独立元数据目录
 * 校验与写入之间仍要求调用方独占目录，不提供对抗外部目录替换的文件系统沙箱
 *
 * @param cwd - release 工作目录
 * @param filename - 配置中的相对日志路径
 * @param signal - Git 查询的取消信号
 * @returns 可写入的规范绝对路径
 * @throws 路径越界、包含元数据或链接、无法读取 Git 目录时抛出
 * @internal
 */
export async function resolveChangelogPath(
  cwd: string,
  filename: string,
  signal?: AbortSignal,
): Promise<string> {
  if (
    !filename ||
    path.isAbsolute(filename) ||
    filename.split(/[/\\]/).some(segment => segment.toLowerCase() === '.git')
  )
    throw new Error(`Invalid changelog filename: ${filename}`)

  const checkedDestination = await resolveWriteDestination(
    path.resolve(cwd, filename),
    cwd,
  )
  // 已存在的祖先使用真实路径，避免大小写不敏感文件系统中的元数据别名绕过排除
  const destination = await canonicalDestination(checkedDestination)
  const { stdout } = await execute(
    'git',
    ['rev-parse', '--path-format=absolute', '--git-dir', '--git-common-dir'],
    { cwd, signal },
  )
  const metadataDirectories = stdout.trim().split(/\r?\n/)
  if (
    metadataDirectories.length !== 2 ||
    metadataDirectories.some(directory => !path.isAbsolute(directory))
  ) {
    throw new Error(
      'Cannot safely resolve Git metadata directories for changelog.',
    )
  }
  for (const directory of metadataDirectories) {
    const canonicalDirectory = await realpath(directory)
    const relative = path.relative(canonicalDirectory, destination)
    if (
      !relative ||
      (relative !== '..' &&
        !relative.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relative))
    ) {
      throw new Error(
        `Changelog destination overlaps Git metadata: ${destination}`,
      )
    }
  }
  return destination
}

async function canonicalDestination(destination: string): Promise<string> {
  const missingSegments: string[] = []
  let current = destination
  while (true) {
    try {
      return path.join(await realpath(current), ...missingSegments.reverse())
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      missingSegments.push(path.basename(current))
      current = path.dirname(current)
    }
  }
}
