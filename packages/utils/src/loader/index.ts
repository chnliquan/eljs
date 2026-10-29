import { loadJson, loadJsonSync, loadYaml, loadYamlSync } from './data'
import { loadJs, loadJsSync } from './javascript'
import { loadTs, loadTsSync } from './typescript'

export { loadJson, loadJsonSync, loadYaml, loadYamlSync } from './data'
export { loadJs, loadJsSync } from './javascript'
export { loadTs, loadTsSync, resolveTsConfig } from './typescript'

/**
 * 默认异步加载器
 */
export const fileLoaders = Object.freeze({
  '.mjs': loadJs,
  '.cjs': loadJs,
  '.js': loadJs,
  '.ts': loadTs,
  '.json': loadJson,
  '.yaml': loadYaml,
  '.yml': loadYaml,
} as const)

/**
 * 默认同步加载器
 */
export const fileLoadersSync = Object.freeze({
  '.cjs': loadJsSync,
  '.js': loadJsSync,
  '.ts': loadTsSync,
  '.json': loadJsonSync,
  '.yaml': loadYamlSync,
  '.yml': loadYamlSync,
} as const)
