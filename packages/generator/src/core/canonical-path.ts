import { realpath } from 'node:fs/promises'
import path from 'node:path'

/**
 * 通过最近存在的父目录解析尚未创建路径的真实位置
 *
 * @remarks
 * 只对完整路径调用 `realpath` 会在末级尚不存在时回退到词法路径，从而遗漏父目录
 * 中的符号链接；逐级回溯可以在写入前统一边界校验和目标锁使用的物理路径身份
 *
 * @param candidate - 已存在或即将创建的路径
 * @returns 解析符号链接后的预期绝对路径
 * @internal
 */
export async function resolveProspectiveCanonicalPath(
  candidate: string,
): Promise<string> {
  let current = path.resolve(candidate)
  const missingSegments: string[] = []

  while (true) {
    try {
      const existingPath = await realpath(current)
      return path.resolve(existingPath, ...missingSegments.reverse())
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'ENOENT' && code !== 'ENOTDIR') {
        throw error
      }

      const parent = path.dirname(current)
      if (parent === current) {
        return path.resolve(candidate)
      }

      missingSegments.push(path.basename(current))
      current = parent
    }
  }
}
