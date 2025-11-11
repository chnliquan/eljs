/**
 * 构造函数选项
 */
export interface ConfigManagerOptions {
  /**
   * 默认配置文件列表
   * @example
   * ['config.ts', 'config.js']
   */
  defaultConfigFiles: string[]
  /**
   * 默认配置文件扩展名
   * @example
   * ['dev', 'staging'] => ['config.dev.ts', 'config.staging.ts']
   */
  defaultConfigExts?: string[]
  /**
   * 工作目录
   * @default process.cwd()
   */
  cwd?: string
}
