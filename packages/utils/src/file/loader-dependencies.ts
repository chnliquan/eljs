import { createRequire } from 'node:module'

const localRequire = createRequire(
  typeof __filename === 'string' ? __filename : import.meta.url,
)

/**
 * 文件加载器的惰性依赖边界
 *
 * 这些依赖只在对应加载器首次使用时才会载入，避免仅导入 utils
 * 就初始化 TypeScript 等体积较大的模块
 */
export function loadImportFresh(): typeof import('import-fresh') {
  return localRequire('import-fresh')
}

export function loadParseJson(): typeof import('parse-json') {
  return localRequire('parse-json')
}

export function loadTypeScript(): typeof import('typescript') {
  return localRequire('typescript')
}

export function loadYaml(): typeof import('js-yaml') {
  return localRequire('js-yaml')
}
