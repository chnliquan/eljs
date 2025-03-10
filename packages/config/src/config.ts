import { deepMerge, isPathExists, isPathExistsSync } from '@eljs/utils'
import { extname, join } from 'node:path'

import { defaultLoaders, defaultLoadersSync } from './defaults'
import { addFileExt, getAbsFiles } from './utils'

/**
 * 配置管理器类参数
 */
export interface ConfigManagerOptions {
  /**
   * 默认配置文件列表（config.ts）
   */
  defaultConfigFiles: string[]
  /**
   * 当前工作目录
   */
  cwd?: string
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
   * @param configExts 配置文件扩展名
   */
  public getConfigSync<T extends object>(configExts?: string[]): T | null {
    const mainConfigFile = ConfigManager.getMainConfigFileSync(
      this.options.defaultConfigFiles,
      this.options.cwd,
    )

    if (!mainConfigFile) {
      return null
    }

    let configFiles = [mainConfigFile]

    if (configExts) {
      configFiles = ConfigManager.getConfigFiles(mainConfigFile, configExts)
    }

    return ConfigManager.getConfigSync(
      getAbsFiles(configFiles, this.options.cwd),
    )
  }

  /**
   * 获取配置项
   * @param configExts 配置文件扩展名
   */
  public async getConfig<T extends object>(
    configExts?: string[],
  ): Promise<T | null> {
    const mainConfigFile = await ConfigManager.getMainConfigFile(
      this.options.defaultConfigFiles,
      this.options.cwd,
    )

    if (!mainConfigFile) {
      return null
    }

    let configFiles = [mainConfigFile]

    if (configExts) {
      configFiles = await ConfigManager.getConfigFiles(
        mainConfigFile,
        configExts,
      )
    }

    return ConfigManager.getConfig(getAbsFiles(configFiles, this.options.cwd))
  }

  /**
   * 获取主配置文件
   * @param configFiles 默认配置文件列表
   * @param cwd 当前工作目录
   */
  public static getMainConfigFileSync(
    configFiles: string[],
    cwd = process.cwd(),
  ): string | undefined {
    let mainConfigFile

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
   * 获取主配置文件
   * @param configFiles 默认配置文件列表
   * @param cwd 当前工作目录
   */
  public static async getMainConfigFile(
    configFiles: string[],
    cwd = process.cwd(),
  ): Promise<string | undefined> {
    let mainConfigFile: string | undefined

    for (const configFile of configFiles) {
      const absConfigFile = join(cwd, configFile)
      if (await isPathExists(absConfigFile)) {
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
  public static getConfigSync<T extends object>(
    configFiles: string[],
  ): T | null {
    let config: T | null = null

    for (const configFile of configFiles) {
      if (isPathExistsSync(configFile)) {
        const loader =
          defaultLoadersSync[
            extname(configFile) as keyof typeof defaultLoadersSync
          ]
        try {
          const content = loader(configFile)
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

  /**
   * 获取配置文件
   * @param configFiles 配置文件列表
   */
  public static async getConfig<T extends object>(
    configFiles: string[],
  ): Promise<T | null> {
    let config: T | null = null

    for (const configFile of configFiles) {
      if (await isPathExists(configFile)) {
        const loader =
          defaultLoaders[extname(configFile) as keyof typeof defaultLoaders]
        try {
          const content = await loader(configFile)
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
