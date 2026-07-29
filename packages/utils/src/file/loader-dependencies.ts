/**
 * 文件加载器的惰性依赖边界。
 *
 * 这些依赖只在对应加载器首次使用时才会载入，避免仅导入 utils
 * 就初始化 TypeScript 等体积较大的模块。
 */
export function loadImportFresh(): typeof import('import-fresh') {
  return require('import-fresh')
}

export function loadParseJson(): typeof import('parse-json') {
  return require('parse-json')
}

export function loadTypeScript(): typeof import('typescript') {
  return require('typescript')
}

export function loadYaml(): typeof import('js-yaml') {
  return require('js-yaml')
}
