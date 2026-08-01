import { createRequire } from 'node:module'

const localRequire = createRequire(import.meta.url)

/**
 * 文件加载器的惰性依赖边界
 *
 * 这些依赖只在对应加载器首次使用时才会载入，避免仅导入 utils
 * 就初始化 TypeScript 等体积较大的模块
 *
 * @returns CommonJS `import-fresh` 模块
 * @internal
 */
export function loadImportFresh(): typeof import('import-fresh') {
  return localRequire('import-fresh')
}

/**
 * 惰性加载 JSON 解析依赖
 * @returns `parse-json` 默认导出的解析函数
 * @internal
 */
export function loadParseJson(): typeof import('parse-json').default {
  return localRequire('parse-json').default
}

/**
 * 惰性加载 TypeScript 编译器
 * @returns TypeScript 编译器模块
 * @internal
 */
export function loadTypeScript(): typeof import('typescript') {
  return localRequire('typescript')
}

/**
 * 惰性加载 YAML 解析依赖
 * @returns CommonJS `js-yaml` 模块
 * @internal
 */
export function loadYaml(): typeof import('js-yaml') {
  return localRequire('js-yaml')
}
