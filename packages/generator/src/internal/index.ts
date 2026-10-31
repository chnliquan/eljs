import { createRequire } from 'node:module'
import { extname } from 'node:path'
import { definePreset } from '../define'

/**
 * 解析开发态源码或构建产物中的内部模块
 *
 * @param request - 相对于当前内部目录的模块请求
 * @param parentPath - 发起解析的模块路径或文件 URL
 * @returns 可由插件运行时加载的绝对模块路径
 */
export function resolveInternalModule(
  request: string,
  parentPath: string,
): string {
  const localRequire = createRequire(parentPath)
  const parentExtension = extname(parentPath)
  const extensions =
    parentExtension === '.cjs' || parentExtension === '.cts'
      ? ['.cjs', '.cts', '.js', '.ts']
      : parentExtension === '.ts'
        ? ['.ts', '.js', '.cts', '.cjs']
        : ['.js', '.ts', '.cjs', '.cts']
  const candidates = extensions.flatMap(extension => [
    `${request}${extension}`,
    `${request}/index${extension}`,
  ])

  for (const candidate of candidates) {
    try {
      return localRequire.resolve(candidate)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'MODULE_NOT_FOUND') {
        throw error
      }
    }
  }

  return localRequire.resolve(request)
}

/**
 * 创建 create 包内置 preset
 *
 * @returns 内置 plugin 声明
 */
export default definePreset(context => {
  return {
    plugins: [
      resolveInternalModule('./plugins/app-data', context.plugin.path),
      resolveInternalModule('./plugins/built-in', context.plugin.path),
      resolveInternalModule('./plugins/generator', context.plugin.path),
      resolveInternalModule('./plugins/git-init', context.plugin.path),
      resolveInternalModule('./plugins/prompts', context.plugin.path),
      resolveInternalModule('./plugins/questions', context.plugin.path),
      resolveInternalModule('./plugins/render', context.plugin.path),
    ],
  }
})
