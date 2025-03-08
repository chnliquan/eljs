import { DEFAULT_CONFIG_FILES } from '@/constants'
import { deepMerge, isPathExistsSync, loadTsSync } from '@eljs/utils'
import { join } from 'path'

import { addFileExt, getAbsFiles } from './utils'

/**
 * 配置管理器类参数
 */
export interface ConfigManagerOptions {
  /**
   * 当前工作目录
   */
  cwd?: string
  /**
   * 默认配置文件列表（config.ts）
   */
  defaultConfigFiles?: string[]
}

/**
 * 配置管理器类
 */
export class ConfigManager {
  /**
   * 配置管理器类参数
   */
  public options: ConfigManagerOptions
  /**
   * 主配置文件
   */
  public mainConfigFile?: string

  public constructor(options: ConfigManagerOptions) {
    this.options = options
  }

  /**
   * 获取配置项
   */
  public getConfig<T extends object>(configExts?: string[]): T | undefined {
    const mainConfigFile = ConfigManager.getMainConfigFile(
      this.options.cwd,
      this.options.defaultConfigFiles,
    )

    if (!mainConfigFile) {
      return
    }

    let configFiles = [mainConfigFile]

    if (configExts) {
      configFiles = ConfigManager.getConfigFiles(mainConfigFile, configExts)
    }

    return ConfigManager.getConfig(getAbsFiles(configFiles, this.options.cwd))
  }

  /**
   * 获取主配置文件
   * @param cwd 当前工作目录
   * @param configFiles 默认配置文件列表
   */
  public static getMainConfigFile(
    cwd = process.cwd(),
    configFiles = DEFAULT_CONFIG_FILES,
  ): string | undefined {
    let mainConfigFile: string | undefined

    for (const configFile of configFiles) {
      const absConfigFile = join(cwd, configFile)
      if (isPathExistsSync(absConfigFile)) {
        mainConfigFile = absConfigFile
        break
      }
    }

    return mainConfigFile
  }

  /**
   * 获取配置文件列表
   * @param mainConfigFile 主配置文件
   * @param configExts 配置文件扩展名
   */
  public static getConfigFiles(
    mainConfigFile: string,
    configExts: string[],
  ): string[] {
    return [
      mainConfigFile,
      ...configExts.map(ext => addFileExt(mainConfigFile, ext)),
    ].filter(Boolean)
  }

  /**
   * 获取配置文件
   * @param configFiles 配置文件列表
   */
  public static getConfig<T extends object>(
    configFiles: string[],
  ): T | undefined {
    let config: T | undefined = undefined

    for (const configFile of configFiles) {
      if (isPathExistsSync(configFile)) {
        try {
          const content = loadTsSync(configFile)
          config = deepMerge(config, content.default)
        } catch (err) {
          throw new Error(`Parse config file failed: [${configFile}].`, {
            cause: err,
          })
        }
      }
    }

    return config
  }
}
