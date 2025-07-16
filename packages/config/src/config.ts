import {
  deepMerge,
  fileLoaders,
  fileLoadersSync,
  isPathExists,
  isPathExistsSync,
} from '@eljs/utils'
import { extname, join } from 'node:path'

import { addFileExt, getAbsFiles } from './utils'

/**
 * ConfigManager constructor options
 */
export interface ConfigManagerOptions {
  /**
   * Default config files
   * @example
   * ['config.ts', 'config.js']
   */
  defaultConfigFiles: string[]
  /**
   * Default config file extensions
   * @example
   * ['dev', 'staging'] => ['config.dev.ts', 'config.staging.ts']
   */
  defaultConfigExts?: string[]
  /**
   * Working directory
   * @default process.cwd()
   */
  cwd?: string
}

/**
 * ConfigManager class
 */
export class ConfigManager {
  /**
   * 构造函数选项
   */
  public constructorOptions: ConfigManagerOptions
  /**
   * 主配置文件
   */
  public mainConfigFile?: string

  public constructor(options: ConfigManagerOptions) {
    this.constructorOptions = options
  }

  /**
   * 获取配置项
   * @param configExts 配置文件扩展名
   */
  public async getConfig<T extends object>(): Promise<T | null> {
    const { defaultConfigFiles, defaultConfigExts, cwd } =
      this.constructorOptions

    const mainConfigFile = await ConfigManager.getMainConfigFile(
      defaultConfigFiles,
      cwd,
    )

    if (!mainConfigFile) {
      return null
    }

    let configFiles = [mainConfigFile]

    if (defaultConfigExts?.length) {
      configFiles = await ConfigManager.getConfigFiles(
        mainConfigFile,
        defaultConfigExts,
      )
    }

    return ConfigManager.getConfig(getAbsFiles(configFiles, cwd))
  }

  /**
   * 获取配置项
   * @param configExts 配置文件扩展名
   */
  public getConfigSync<T extends object>(): T | null {
    const { defaultConfigFiles, defaultConfigExts, cwd } =
      this.constructorOptions

    const mainConfigFile = ConfigManager.getMainConfigFileSync(
      defaultConfigFiles,
      cwd,
    )

    if (!mainConfigFile) {
      return null
    }

    let configFiles = [mainConfigFile]

    if (defaultConfigExts?.length) {
      configFiles = ConfigManager.getConfigFiles(
        mainConfigFile,
        defaultConfigExts,
      )
    }

    return ConfigManager.getConfigSync(getAbsFiles(configFiles, cwd))
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
  public static async getConfig<T extends object>(
    configFiles: string[],
  ): Promise<T | null> {
    let config: T | null = null

    for (const configFile of configFiles) {
      if (await isPathExists(configFile)) {
        const loader =
          fileLoaders[extname(configFile) as keyof typeof fileLoaders]

        try {
          const content = (await loader(configFile)) as { default: T }

          if (!content) {
            return config
          }

          config = deepMerge(config as T, content.default ?? content) as T
        } catch (error) {
          const err = error as Error
          err.message = err.message.replace(
            /Load (\/.*?) failed:/,
            `Load config ${configFile} failed:`,
          )
          throw err
        }
      }
    }

    return config
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
          fileLoadersSync[extname(configFile) as keyof typeof fileLoadersSync]

        try {
          const content = loader(configFile) as { default: T }

          if (!content) {
            return config
          }

          config = deepMerge(config as T, content.default ?? content) as T
        } catch (error) {
          const err = error as Error
          err.message = err.message.replace(
            /Load (\/.*?) failed:/,
            `Load config ${configFile} failed:`,
          )
          throw err
        }
      }
    }

    return config
  }
}
