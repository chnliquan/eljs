/**
 * 支持的插件入口扩展名
 */
export const SUPPORTED_PLUGIN_EXTENSIONS = [
  '.js',
  '.cjs',
  '.mjs',
  '.ts',
  '.cts',
] as const

/**
 * 支持的插件入口扩展名联合类型
 */
export type SupportedPluginExtension =
  (typeof SUPPORTED_PLUGIN_EXTENSIONS)[number]
