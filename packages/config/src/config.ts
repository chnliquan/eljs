/* eslint-disable @typescript-eslint/no-explicit-any */
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
   */
  public async getConfig<
    T extends Record<string, any> = Record<string, any>,
  >(): Promise<T | null>
  /**
   * 获取配置项（带默认配置）
   * @param defaultConfig - 默认配置对象，当没有找到配置文件或需要合并时使用
   */
  public async getConfig<T extends Record<string, any>>(
    defaultConfig: T,
  ): Promise<T>
  public async getConfig<T extends Record<string, any>>(
    defaultConfig?: T,
  ): Promise<T | null> {
    const { defaultConfigFiles, defaultConfigExts, cwd } =
      this.constructorOptions

    const mainConfigFile = await ConfigManager.getMainConfigFile(
      defaultConfigFiles,
      cwd,
    )

    if (!mainConfigFile) {
      return defaultConfig || null
    }

    let configFiles = [mainConfigFile]

    if (defaultConfigExts?.length) {
      configFiles = await ConfigManager.getConfigFiles(
        mainConfigFile,
        defaultConfigExts,
      )
    }

    const loadedConfig = (await ConfigManager.getConfig(
      getAbsFiles(configFiles, cwd),
    )) as T | null

    if (defaultConfig) {
      return deepMerge(defaultConfig, loadedConfig || {}) as T
    }

    return loadedConfig
  }

  /**
   * 同步获取配置项
   */
  public getConfigSync<
    T extends Record<string, any> = Record<string, any>,
  >(): T | null
  /**
   * 同步获取配置项（带默认配置）
   * @param defaultConfig - 默认配置对象，当没有找到配置文件或需要合并时使用
   */
  public getConfigSync<T extends Record<string, any>>(defaultConfig: T): T
  public getConfigSync<T extends Record<string, any>>(
    defaultConfig?: T,
  ): T | null {
    const { defaultConfigFiles, defaultConfigExts, cwd } =
      this.constructorOptions

    const mainConfigFile = ConfigManager.getMainConfigFileSync(
      defaultConfigFiles,
      cwd,
    )

    if (!mainConfigFile) {
      return defaultConfig || null
    }

    let configFiles = [mainConfigFile]

    if (defaultConfigExts?.length) {
      configFiles = ConfigManager.getConfigFiles(
        mainConfigFile,
        defaultConfigExts,
      )
    }

    const loadedConfig = ConfigManager.getConfigSync(
      getAbsFiles(configFiles, cwd),
    ) as T | null

    if (defaultConfig) {
      return deepMerge(defaultConfig, loadedConfig || {}) as T
    }

    return loadedConfig
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
   * @param configFiles - 配置文件路径列表（绝对路径）
   */
  public static async getConfig<
    T extends Record<string, any> = Record<string, any>,
  >(configFiles: string[]): Promise<T | null>
  /**
   * 获取配置文件（带默认配置）
   * @param configFiles - 配置文件路径列表（绝对路径）
   * @param defaultConfig - 默认配置对象，用作基础配置
   */
  public static async getConfig<T extends Record<string, any>>(
    configFiles: string[],
    defaultConfig: T,
  ): Promise<T>
  public static async getConfig<T extends Record<string, any>>(
    configFiles: string[],
    defaultConfig?: T,
  ): Promise<T | null> {
    let config: T | null = defaultConfig ? ({ ...defaultConfig } as T) : null

    for (const configFile of configFiles) {
      if (await isPathExists(configFile)) {
        const loader =
          fileLoaders[extname(configFile) as keyof typeof fileLoaders]

        try {
          const content = (await loader(configFile)) as any

          if (!content) {
            continue
          }

          const actualConfig = content.default ?? content

          if (config) {
            config = deepMerge(config, actualConfig) as T
          } else {
            config = actualConfig as T
          }
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
   * 同步获取配置文件
   * @param configFiles - 配置文件路径列表（绝对路径）
   */
  public static getConfigSync<
    T extends Record<string, any> = Record<string, any>,
  >(configFiles: string[]): T | null

  /**
   * 同步获取配置文件（带默认配置）
   * @param configFiles - 配置文件路径列表（绝对路径）
   * @param defaultConfig - 默认配置对象，用作基础配置
   */
  public static getConfigSync<T extends Record<string, any>>(
    configFiles: string[],
    defaultConfig: T,
  ): T
  public static getConfigSync<T extends Record<string, any>>(
    configFiles: string[],
    defaultConfig?: T,
  ): T | null {
    let config: T | null = defaultConfig ? ({ ...defaultConfig } as T) : null

    for (const configFile of configFiles) {
      if (isPathExistsSync(configFile)) {
        const loader =
          fileLoadersSync[extname(configFile) as keyof typeof fileLoadersSync]

        try {
          const content = loader(configFile) as any

          if (!content) {
            continue
          }

          const actualConfig = content.default ?? content

          if (config) {
            config = deepMerge(config, actualConfig) as T
          } else {
            config = actualConfig as T
          }
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
