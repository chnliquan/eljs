import { pathToFileURL } from 'node:url'

import { isESModule } from '../guards'
import { loadImportFresh } from './loader-dependencies'

/**
 * 加载 JavaScript 文件
 * @param path - 文件路径
 * @returns 模块默认导出或 CommonJS 导出
 * @throws 动态导入失败时抛出带路径上下文的原错误
 */
export async function loadJs<T>(path: string): Promise<T> {
  try {
    const { href } = pathToFileURL(path)
    const content = await import(href)
    return isESModule<T>(content) ? content.default : content
  } catch (error) {
    const err = error as Error
    err.message = `Load ${path} failed: ${err.message}`
    throw err
  }
}

let importFresh: typeof import('import-fresh')

/**
 * 同步加载 JavaScript 文件
 * @param path - 文件路径
 * @returns CommonJS 模块导出
 * @throws 加载失败时抛出带路径上下文的错误
 */
export function loadJsSync<T>(path: string): T {
  importFresh ||= loadImportFresh()

  try {
    return importFresh(path) as T
  } catch (error) {
    const err = error as Error
    err.message = `Load ${path} failed: ${err.message}`
    throw err
  }
}
