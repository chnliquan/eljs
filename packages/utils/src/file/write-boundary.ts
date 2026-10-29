import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'

function isContainedRelative(relative: string): boolean {
  return (
    relative !== '' &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  )
}

function relativeDestination(
  destination: string,
  root: string,
  canonicalRoot: string,
): string {
  const lexicalRelative = path.relative(root, path.resolve(destination))
  const relative = isContainedRelative(lexicalRelative)
    ? lexicalRelative
    : path.relative(canonicalRoot, path.resolve(destination))
  if (!isContainedRelative(relative)) {
    throw new Error(`Write destination escapes root: ${destination}`)
  }
  return relative
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT'
}

/**
 * 将写入目标收敛到已存在的根目录，并拒绝目标路径中任何符号链接
 *
 * @remarks
 * 校验在路径模板渲染后执行，返回使用根目录真实位置的绝对路径
 * 根目录本身可使用符号链接别名，但其子路径中的链接（包括悬空链接）均被拒绝
 * 调用方必须独占目标目录直到写入结束，路径检查不提供针对外部并发替换目录的文件系统沙箱
 *
 * @param destination - 待写入的文件路径
 * @param root - 必须存在且由调用方管理的输出根目录
 * @returns 通过边界检查的规范目标路径
 * @throws 路径超出根目录、根目录不是目录、子路径含符号链接或访问失败时抛出
 */
export async function resolveWriteDestination(
  destination: string,
  root: string,
): Promise<string> {
  const lexicalRoot = path.resolve(root)
  const canonicalRoot = await fsp.realpath(lexicalRoot)
  if (!(await fsp.stat(canonicalRoot)).isDirectory()) {
    throw new Error(`Write root is not a directory: ${root}`)
  }
  const relative = relativeDestination(destination, lexicalRoot, canonicalRoot)
  let current = canonicalRoot
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment)
    try {
      if ((await fsp.lstat(current)).isSymbolicLink()) {
        throw new Error(
          `Write destination contains a symbolic link: ${current}`,
        )
      }
    } catch (error) {
      if (!isMissing(error)) {
        throw error
      }
    }
  }
  return current
}

/**
 * 同步收敛写入目标并拒绝输出根目录之下的符号链接
 *
 * @remarks
 * 与异步版本使用相同的边界契约，调用方必须独占目标目录直到写入完成
 *
 * @param destination - 路径模板渲染后的文件路径
 * @param root - 必须存在的输出根目录
 * @returns 通过边界检查的规范目标路径
 * @throws 路径越界、子路径含链接或文件系统访问失败时抛出
 */
export function resolveWriteDestinationSync(
  destination: string,
  root: string,
): string {
  const lexicalRoot = path.resolve(root)
  const canonicalRoot = fs.realpathSync(lexicalRoot)
  if (!fs.statSync(canonicalRoot).isDirectory()) {
    throw new Error(`Write root is not a directory: ${root}`)
  }
  const relative = relativeDestination(destination, lexicalRoot, canonicalRoot)
  let current = canonicalRoot
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment)
    try {
      if (fs.lstatSync(current).isSymbolicLink()) {
        throw new Error(
          `Write destination contains a symbolic link: ${current}`,
        )
      }
    } catch (error) {
      if (!isMissing(error)) {
        throw error
      }
    }
  }
  return current
}
