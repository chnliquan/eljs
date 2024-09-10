import { Env } from '../types/env'
export interface ConfigManagerOpts {
  /**
   * 当前路径
   */
  cwd: string
  /**
   * 当前环境
   */
  env: Env
  /**
   * 默认的配置文件列表
   */
  defaultConfigFiles?: string[]
}
export declare class ConfigManager {
  opts: ConfigManagerOpts
  /**
   * 主配置文件地址
   */
  mainConfigFile: string | null
  constructor(opts: ConfigManagerOpts)
  getUserConfig(): {
    config: {
      presets: never[]
      plugins: never[]
    }
    files: string[]
  }
  getConfig(opts: { schemas: Record<string, any> }): {
    config: {
      presets: never[]
      plugins: never[]
    }
    files: string[]
  }
  static getMainConfigFile(opts: {
    cwd: string
    defaultConfigFiles?: string[]
  }): string | null
  static getConfigFiles(opts: {
    mainConfigFile: string | null
    env: Env
  }): string[]
  static getUserConfig(opts: { configFiles: string[] }): {
    config: {
      presets: never[]
      plugins: never[]
    }
    files: string[]
  }
  static validateConfig(opts: {
    config: Record<string, any>
    schemas: Record<string, any>
  }): void
}
//# sourceMappingURL=manager.d.ts.map
