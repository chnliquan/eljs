import { loadConfigFiles, loadConfigFilesSync } from './load'
import { isConfigPathAvailable, isConfigPathAvailableSync } from './path'
import type { ConfigLoadOptions, ConfigManagerOptions } from './types'
import { addFileExt, getAbsFiles } from './utils'

/**
 * 按候选文件与环境后缀加载并合并本地配置
 *
 * @remarks
 * 候选文件按声明顺序查找且只选择第一个存在的文件，环境配置按后缀顺序加载，后加载的对象覆盖先加载的同名标量
 * JavaScript 与 TypeScript 配置会在当前进程中执行，只能加载可信来源
 */
export class ConfigManager {
  /** 当前实例使用的只读构造选项副本 */
  public readonly constructorOptions: Readonly<ConfigManagerOptions>

  /**
   * 最近一次实例加载所发现的主配置文件绝对路径状态
   *
   * @remarks
   * 该生命周期状态只由实例加载方法更新，不允许调用方覆盖
   */
  private _mainConfigFile?: string

  /**
   * 创建配置管理器
   *
   * @param options - 文件候选、环境后缀、解析基准与可选扩展点
   */
  public constructor(options: ConfigManagerOptions) {
    this.constructorOptions = Object.freeze({
      ...options,
      defaultConfigExts: options.defaultConfigExts
        ? Object.freeze([...options.defaultConfigExts])
        : undefined,
      defaultConfigFiles: Object.freeze([...options.defaultConfigFiles]),
    })
  }

  /**
   * 最近一次实例加载所发现的主配置文件绝对路径
   *
   * @remarks
   * 首次加载前为 `undefined`，未找到候选文件时也会重置为 `undefined`
   */
  public get mainConfigFile(): string | undefined {
    return this._mainConfigFile
  }

  /**
   * 异步发现并加载配置
   *
   * @returns 合并后的配置，未找到主配置时返回 `null`
   * @throws 配置格式不支持、内容无效或加载、合并、验证失败时抛出 `ConfigLoadError`
   */
  public async getConfig<
    T extends object = Record<string, unknown>,
  >(): Promise<T | null>

  /**
   * 异步发现并加载配置，使用默认配置作为合并基础
   *
   * @param defaultConfig - 默认配置对象，当没有找到配置文件或需要合并时使用
   * @returns 合并后的非空配置
   * @throws 配置格式不支持、内容无效或加载、合并、验证失败时抛出 `ConfigLoadError`
   */
  public async getConfig<T extends object>(defaultConfig: T): Promise<T>

  public async getConfig<T extends object>(
    defaultConfig?: T,
  ): Promise<T | null> {
    const {
      defaultConfigFiles,
      defaultConfigExts,
      cwd,
      merge,
      reload,
      validate,
    } = this.constructorOptions
    const mainConfigFile = await ConfigManager.getMainConfigFile(
      defaultConfigFiles,
      cwd,
    )
    this._mainConfigFile = mainConfigFile

    if (!mainConfigFile) {
      return defaultConfig
        ? ConfigManager.getConfig([], defaultConfig, {
            merge,
            reload,
            validate,
          })
        : null
    }

    const configFiles = defaultConfigExts?.length
      ? ConfigManager.getConfigFiles(mainConfigFile, defaultConfigExts)
      : [mainConfigFile]
    const absoluteConfigFiles = getAbsFiles(configFiles, cwd)

    return defaultConfig
      ? ConfigManager.getConfig(absoluteConfigFiles, defaultConfig, {
          merge,
          reload,
          validate,
        })
      : ConfigManager.getConfig<T>(absoluteConfigFiles, undefined, {
          merge,
          reload,
          validate,
        })
  }

  /**
   * 同步发现并加载配置
   *
   * @returns 合并后的配置，未找到主配置时返回 `null`
   * @throws 配置格式不支持、内容无效或加载、合并、验证失败时抛出 `ConfigLoadError`
   */
  public getConfigSync<T extends object = Record<string, unknown>>(): T | null

  /**
   * 同步发现并加载配置，使用默认配置作为合并基础
   *
   * @param defaultConfig - 默认配置对象，当没有找到配置文件或需要合并时使用
   * @returns 合并后的非空配置
   * @throws 配置格式不支持、内容无效或加载、合并、验证失败时抛出 `ConfigLoadError`
   */
  public getConfigSync<T extends object>(defaultConfig: T): T

  public getConfigSync<T extends object>(defaultConfig?: T): T | null {
    const {
      defaultConfigFiles,
      defaultConfigExts,
      cwd,
      merge,
      reload,
      validate,
    } = this.constructorOptions
    const mainConfigFile = ConfigManager.getMainConfigFileSync(
      defaultConfigFiles,
      cwd,
    )
    this._mainConfigFile = mainConfigFile

    if (!mainConfigFile) {
      return defaultConfig
        ? ConfigManager.getConfigSync([], defaultConfig, {
            merge,
            reload,
            validate,
          })
        : null
    }

    const configFiles = defaultConfigExts?.length
      ? ConfigManager.getConfigFiles(mainConfigFile, defaultConfigExts)
      : [mainConfigFile]
    const absoluteConfigFiles = getAbsFiles(configFiles, cwd)

    return defaultConfig
      ? ConfigManager.getConfigSync(absoluteConfigFiles, defaultConfig, {
          merge,
          reload,
          validate,
        })
      : ConfigManager.getConfigSync<T>(absoluteConfigFiles, undefined, {
          merge,
          reload,
          validate,
        })
  }

  /**
   * 按顺序查找第一个存在的主配置文件
   *
   * @param configFiles - 相对或绝对候选文件路径
   * @param cwd - 相对候选路径的解析基准
   * @returns 第一个存在的候选文件绝对路径，全部不存在时返回 `undefined`
   */
  public static async getMainConfigFile(
    configFiles: readonly string[],
    cwd = process.cwd(),
  ): Promise<string | undefined> {
    for (const absConfigFile of getAbsFiles(configFiles, cwd)) {
      if (await isConfigPathAvailable(absConfigFile)) {
        return absConfigFile
      }
    }

    return undefined
  }

  /**
   * 同步按顺序查找第一个存在的主配置文件
   *
   * @param configFiles - 相对或绝对候选文件路径
   * @param cwd - 相对候选路径的解析基准
   * @returns 第一个存在的候选文件绝对路径，全部不存在时返回 `undefined`
   */
  public static getMainConfigFileSync(
    configFiles: readonly string[],
    cwd = process.cwd(),
  ): string | undefined {
    for (const absConfigFile of getAbsFiles(configFiles, cwd)) {
      if (isConfigPathAvailableSync(absConfigFile)) {
        return absConfigFile
      }
    }

    return undefined
  }

  /**
   * 生成主配置与环境配置的有序文件列表
   *
   * @param mainConfigFile - 主配置文件路径
   * @param configExts - 按加载顺序声明的环境后缀，空后缀会被忽略
   * @returns 主配置在前、环境配置在后的文件列表
   */
  public static getConfigFiles(
    mainConfigFile: string,
    configExts: readonly string[],
  ): string[] {
    return [
      mainConfigFile,
      ...configExts.filter(Boolean).map(ext => addFileExt(mainConfigFile, ext)),
    ]
  }

  /**
   * 按输入顺序异步加载并合并配置文件
   *
   * @param configFiles - 配置文件绝对路径列表
   * @returns 合并后的配置，没有可加载内容时返回 `null`
   * @throws 加载、合并或验证失败时抛出 `ConfigLoadError`
   */
  public static async getConfig<T extends object = Record<string, unknown>>(
    configFiles: readonly string[],
  ): Promise<T | null>

  /**
   * 按输入顺序异步加载并合并配置文件，且不提供默认配置
   *
   * @param configFiles - 配置文件绝对路径列表
   * @param defaultConfig - 必须为 `undefined`
   * @param options - 自定义合并、重新加载与最终验证选项
   * @returns 合并后的配置，没有可加载内容时返回 `null`
   * @throws 加载、合并或验证失败时抛出 `ConfigLoadError`
   */
  public static async getConfig<T extends object = Record<string, unknown>>(
    configFiles: readonly string[],
    defaultConfig: undefined,
    options: ConfigLoadOptions,
  ): Promise<T | null>

  /**
   * 按输入顺序异步加载并合并配置文件，使用默认配置作为合并基础
   *
   * @param configFiles - 配置文件绝对路径列表
   * @param defaultConfig - 默认配置对象
   * @param options - 自定义合并、重新加载与最终验证选项
   * @returns 合并后的非空配置
   * @throws 加载、合并或验证失败时抛出 `ConfigLoadError`
   */
  public static async getConfig<T extends object>(
    configFiles: readonly string[],
    defaultConfig: T,
    options?: ConfigLoadOptions,
  ): Promise<T>

  public static async getConfig<T extends object>(
    configFiles: readonly string[],
    defaultConfig?: T,
    options: ConfigLoadOptions = {},
  ): Promise<T | null> {
    return loadConfigFiles(configFiles, defaultConfig, options)
  }

  /**
   * 按输入顺序同步加载并合并配置文件
   *
   * @param configFiles - 配置文件绝对路径列表
   * @returns 合并后的配置，没有可加载内容时返回 `null`
   * @throws 加载、合并或验证失败时抛出 `ConfigLoadError`
   */
  public static getConfigSync<T extends object = Record<string, unknown>>(
    configFiles: readonly string[],
  ): T | null

  /**
   * 按输入顺序同步加载并合并配置文件，且不提供默认配置
   *
   * @param configFiles - 配置文件绝对路径列表
   * @param defaultConfig - 必须为 `undefined`
   * @param options - 自定义合并与最终验证选项
   * @returns 合并后的配置，没有可加载内容时返回 `null`
   * @throws 加载、合并或验证失败时抛出 `ConfigLoadError`
   */
  public static getConfigSync<T extends object = Record<string, unknown>>(
    configFiles: readonly string[],
    defaultConfig: undefined,
    options: ConfigLoadOptions,
  ): T | null

  /**
   * 按输入顺序同步加载并合并配置文件，使用默认配置作为合并基础
   *
   * @param configFiles - 配置文件绝对路径列表
   * @param defaultConfig - 默认配置对象
   * @param options - 自定义合并与最终验证选项
   * @returns 合并后的非空配置
   * @throws 加载、合并或验证失败时抛出 `ConfigLoadError`
   */
  public static getConfigSync<T extends object>(
    configFiles: readonly string[],
    defaultConfig: T,
    options?: ConfigLoadOptions,
  ): T

  public static getConfigSync<T extends object>(
    configFiles: readonly string[],
    defaultConfig?: T,
    options: ConfigLoadOptions = {},
  ): T | null {
    return loadConfigFilesSync(configFiles, defaultConfig, options)
  }
}
