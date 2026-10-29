import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { isESModule } from '../guards'
import { loadImportFresh } from '../internal/lazy-dependencies'
import { contextualizeError } from './error'

/**
 * 加载 JavaScript 文件
 * @param path - 文件路径，相对路径以当前工作目录为基准
 * @returns 模块默认导出或 CommonJS 导出
 * @throws 动态导入失败时补充路径上下文；不可修改的错误或其他抛出值通过 `cause` 保留
 */
export async function loadJs<T>(path: string): Promise<T> {
  try {
    const { href } = pathToFileURL(path)
    const content = await import(href)
    return isESModule<T>(content) ? content.default : content
  } catch (error) {
    throw contextualizeError(error, `Load ${path} failed`)
  }
}

let importFresh: typeof import('import-fresh')

/**
 * 同步加载 JavaScript 文件
 * @param path - 文件路径，相对路径以当前工作目录为基准
 * @returns CommonJS 模块导出
 * @throws 加载失败时补充路径上下文；不可修改的错误或其他抛出值通过 `cause` 保留
 */
export function loadJsSync<T>(path: string): T {
  importFresh ||= loadImportFresh()

  try {
    return importFresh(resolve(path)) as T
  } catch (error) {
    throw contextualizeError(error, `Load ${path} failed`)
  }
}
