/* eslint-disable @typescript-eslint/naming-convention */
import { loadJs, loadJsSync, loadTs, loadTsSync } from '@eljs/utils'

/**
 * 同步加载器
 */
export const defaultLoadersSync = Object.freeze({
  '.mjs': loadJsSync,
  '.cjs': loadJsSync,
  '.js': loadJsSync,
  '.ts': loadTsSync,
} as const)

/**
 * 异步加载器
 */
export const defaultLoaders = Object.freeze({
  '.mjs': loadJs,
  '.cjs': loadJs,
  '.js': loadJs,
  '.ts': loadTs,
} as const)
