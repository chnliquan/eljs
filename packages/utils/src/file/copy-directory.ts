import { glob, globSync } from 'glob'
import path from 'node:path'

import { copyFile, copyFileSync } from './copy-file'
import type { CopyFileOptions } from './copy-options'
import { copyTemplate, copyTemplateSync } from './copy-template'
import { isDirectory, isDirectorySync } from './is'

/**
 * 复制目录内容并渲染其中的 `.tpl` 模板
 * @param from - 源目录路径
 * @param to - 目标目录路径
 * @param data - 模板数据
 * @param options - 复制选项
 * @returns 目录复制完成后结束
 * @throws 文件枚举、复制或模板渲染失败时抛出带目录上下文的错误
 */
export async function copyDirectory(
  from: string,
  to: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
  options: CopyFileOptions = {},
): Promise<void> {
  try {
    const files = await glob('**/*', {
      cwd: from,
      dot: true,
      ignore: ['**/node_modules/**'],
    })

    for (const file of files) {
      const source = path.join(from, file)

      if (await isDirectory(source)) {
        continue
      }

      const destination = path.join(to, file)

      if (file.endsWith('.tpl')) {
        await copyTemplate(source, destination, data, options)
      } else {
        await copyFile(source, destination, { ...options, data })
      }
    }
  } catch (error) {
    const err = error as Error
    err.message = `Copy directory from ${from} to ${to} failed: ${err.message}`
    throw err
  }
}

/**
 * 同步复制目录内容并渲染其中的 `.tpl` 模板
 * @param from - 源目录路径
 * @param to - 目标目录路径
 * @param data - 模板数据
 * @param options - 复制选项
 * @throws 文件枚举、复制或模板渲染失败时抛出带目录上下文的错误
 */
export function copyDirectorySync(
  from: string,
  to: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
  options: CopyFileOptions = {},
): void {
  try {
    const files = globSync('**/*', {
      cwd: from,
      dot: true,
      ignore: ['**/node_modules/**'],
    })

    for (const file of files) {
      const source = path.join(from, file)

      if (isDirectorySync(source)) {
        continue
      }

      const destination = path.join(to, file)

      if (file.endsWith('.tpl')) {
        copyTemplateSync(source, destination, data, options)
      } else {
        copyFileSync(source, destination, { ...options, data })
      }
    }
  } catch (error) {
    const err = error as Error
    err.message = `Copy directory from ${from} to ${to} failed: ${err.message}`
    throw err
  }
}
