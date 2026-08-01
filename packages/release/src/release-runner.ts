import {
  PluginHost,
  PluginHostError,
  PluginHostErrorCode,
} from '@eljs/plugin-host'
import {
  chalk,
  createDebugger,
  deepMerge,
  isPathExistsSync,
  logger,
  readJsonSync,
  type PackageJson,
  type RequiredRecursive,
} from '@eljs/utils'
import { createRequire } from 'node:module'
import { EOL } from 'node:os'
import path from 'node:path'
import type { ReleaseType } from 'semver'
import { ReleaseRunnerStage, type AppData, type Config } from './types'

import { defaultConfig } from './default'
import { releaseHookSchema, type ReleasePluginCapabilities } from './hooks'
import { resolveInternalModule } from './internal'
import { AppError, parseVersion } from './utils'

const currentModulePath =
  typeof __filename === 'string' ? __filename : import.meta.url
const localRequire = createRequire(currentModulePath)
const debug = createDebugger('release:config')

/**
 * 编排版本计算、版本更新和发布 Hook 的运行器
 */
export class ReleaseRunner extends PluginHost<
  Config,
  typeof releaseHookSchema,
  ReleasePluginCapabilities
> {
  /**
   * 已解析的最终配置
   */
  private _config: RequiredRecursive<Config> | null = null
  /**
   * 发布流程共享的项目及工作区数据
   */
  public appData: AppData = Object.create(null)
  /**
   * 当前发布阶段的内部可变值
   */
  private _stage = ReleaseRunnerStage.Uninitialized

  /**
   * 当前发布阶段
   *
   * @returns 只读阶段值
   */
  public get stage(): ReleaseRunnerStage {
    return this._stage
  }

  /**
   * 合并默认值、构造选项、用户配置和 `modifyConfig` Hook 后的最终配置
   *
   * @remarks
   * 插件初始化及 `modifyConfig` Hook 执行期间最终配置尚未生成
   * `modifyConfig` Hook 应使用其入参读取和修改当前配置
   *
   * @returns 已解析的 release 配置
   * @throws {@link PluginHostError}
   * 当配置尚未解析时抛出
   */
  public get config(): RequiredRecursive<Config> {
    if (!this._config) {
      throw new PluginHostError(
        PluginHostErrorCode.InvalidState,
        `ReleaseRunner.config is unavailable before the \`${ReleaseRunnerStage.ResolvingConfig}\` stage completes.`,
        { details: { stage: this._stage } },
      )
    }

    return this._config
  }

  /**
   * 创建发布运行器并校验项目清单
   *
   * @param options - 发布配置和插件声明
   * @throws {@link AppError}
   * 当项目缺少 `package.json` 或版本号时抛出
   */
  public constructor(options: Config = {}) {
    const { cwd = process.cwd(), presets = [], plugins = [] } = options
    const projectPkgJsonPath = path.join(cwd, 'package.json')

    if (!isPathExistsSync(projectPkgJsonPath)) {
      throw new AppError(`No package.json was found in ${chalk.cyan(cwd)}.`)
    }

    const projectPkg = readJsonSync<PackageJson>(projectPkgJsonPath)

    if (!projectPkg.version) {
      throw new AppError(
        `No version field was found in ${chalk.cyan(projectPkgJsonPath)}.`,
      )
    }

    super(
      {
        ...options,
        cwd,
        defaultConfigFiles: ['release.config.ts', 'release.config.js'],
        presets: [
          resolveInternalModule('./internal/index', currentModulePath),
          ...presets,
        ],
        plugins,
      },
      releaseHookSchema,
    )

    this.appData = {
      projectPkgJsonPath,
      projectPkg,
    } as AppData
  }

  /**
   * 加载插件并依次执行发布生命周期
   *
   * @param releaseTypeOrVersion - semver 升级类型或明确版本号
   * @returns 发布流程完成后兑现的 Promise
   */
  public async run(releaseTypeOrVersion?: ReleaseType | string): Promise<void> {
    if (this._stage !== ReleaseRunnerStage.Uninitialized) {
      throw new PluginHostError(
        PluginHostErrorCode.InvalidState,
        `ReleaseRunner.run() can only be called once from the \`${ReleaseRunnerStage.Uninitialized}\` stage, current stage is \`${this._stage}\`.`,
        { details: { stage: this._stage } },
      )
    }

    try {
      this._stage = ReleaseRunnerStage.LoadingPlugins
      await this.load()

      this._stage = ReleaseRunnerStage.ResolvingConfig
      await this._resolveConfig()

      this._stage = ReleaseRunnerStage.Preparing
      /**
       * 修改应用数据
       */
      this.appData = await this.runHook('modifyAppData', {
        initialValue: {
          ...this.appData,
          cliVersion: localRequire('../package.json').version,
          packageManager: 'pnpm',
        } as AppData,
        args: {
          cwd: this.cwd,
        },
      })

      /**
       * 应用检查
       */
      await this.runHook('onCheck', {
        args: {
          releaseTypeOrVersion,
        },
      })
      /**
       * 应用启动
       */
      await this.runHook('onStart')
      /**
       * 获取升级版本
       */
      this._stage = ReleaseRunnerStage.Versioning
      const rawVersion = await this.runHook('getIncrementVersion', {
        args: {
          releaseTypeOrVersion,
        },
      })

      if (rawVersion) {
        const version = parseVersion(rawVersion)

        await this.runHook('onBeforeBumpVersion', {
          args: {
            ...version,
          },
        })

        await this.runHook('onBumpVersion', {
          args: {
            ...version,
          },
        })

        await this.runHook('onAfterBumpVersion', {
          args: {
            ...version,
          },
        })

        const changelog =
          (await this.runHook('getChangelog', {
            args: {
              ...version,
            },
          })) || ''

        this._stage = ReleaseRunnerStage.Releasing
        await this.runHook('onBeforeRelease', {
          args: {
            ...version,
            changelog,
          },
        })

        await this.runHook('onRelease', {
          args: {
            ...version,
            changelog,
          },
        })

        await this.runHook('onAfterRelease', {
          args: {
            ...version,
            changelog,
          },
        })
      }
      this._stage = ReleaseRunnerStage.Completed
    } catch (error) {
      this._stage = ReleaseRunnerStage.Failed
      throw error
    }
  }

  /**
   * 输出一条发布步骤日志
   *
   * @param message - 日志信息
   */
  public step(message: string): void {
    return logger.step('Release', `${message}${EOL}`)
  }

  /**
   * 合并配置并执行配置修改 Hook
   *
   * @returns 配置解析完成后兑现的 Promise
   */
  private async _resolveConfig(): Promise<void> {
    const mergedConfig = deepMerge(
      {},
      defaultConfig,
      this.constructorOptions,
      this.userConfig || {},
    ) as RequiredRecursive<Config>

    debug?.(mergedConfig)
    this._config = await this.runHook('modifyConfig', {
      initialValue: mergedConfig,
    })
  }

  /**
   * 为 release 插件上下文提供运行时数据和日志能力
   *
   * @returns release 插件可访问的能力
   */
  protected override getPluginContextExtensions(): ReleasePluginCapabilities {
    const getConfig = () => this.config
    const getAppData = () => this.appData

    return {
      get config() {
        return getConfig()
      },
      get appData() {
        return getAppData()
      },
      step: message => this.step(message),
    }
  }
}
