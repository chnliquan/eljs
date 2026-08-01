import { loadJson, loadJsonSync, loadYaml, loadYamlSync } from './loader-data'
import { loadJs, loadJsSync } from './loader-javascript'
import { loadTs, loadTsSync } from './loader-typescript'

export { loadJson, loadJsonSync, loadYaml, loadYamlSync } from './loader-data'
export { loadJs, loadJsSync } from './loader-javascript'
export { loadTs, loadTsSync, resolveTsConfig } from './loader-typescript'

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
