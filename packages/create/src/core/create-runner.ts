import {
  PluginHost,
  PluginHostError,
  PluginHostErrorCode,
  type PluginHostOptions,
} from '@eljs/plugin-host'
import { deepMerge } from '@eljs/utils/object'
import { createRequire } from 'node:module'

import { defaultConfig } from '../default'
import { createHookSchema, type CreatePluginCapabilities } from '../hooks'
import { resolveInternalModule } from '../internal'
import { installRequireHook } from '../require-hook'
import {
  CreateRunnerStage,
  type AppData,
  type Config,
  type Paths,
  type Prompts,
  type ResolvedConfig,
} from '../types'

const currentModulePath = import.meta.url
const localRequire = createRequire(currentModulePath)

/**
 * 创建项目生成运行器的构造选项
 *
 * @remarks
 * `cwd` 必须指向包含 create 配置的模版根目录
 * 模版配置会覆盖默认配置，显式构造选项拥有最高优先级
 */
export interface CreateRunnerOptions
  extends
    Omit<PluginHostOptions, 'defaultConfigFiles'>,
    Omit<Config, 'cwd' | 'plugins' | 'presets' | 'template'> {}

/**
 * 编排项目创建配置收集、交互输入和文件生成 Hook 的运行器
 */
export class CreateRunner extends PluginHost<
  Config,
  typeof createHookSchema,
  CreatePluginCapabilities
> {
  /**
   * 已解析的最终配置
   */
  private _config: ResolvedConfig | null = null
  /**
   * 当前项目创建阶段
   */
  private _stage = CreateRunnerStage.Uninitialized
  /**
   * 已完成 Hook 收集的项目路径
   */
  private _paths: Paths | null = null
  /**
   * 已完成 Hook 收集的项目元数据
   */
  private _appData: AppData | null = null
  /**
   * 已完成 Hook 收集的用户交互输入
   */
  private _prompts: Prompts | null = null

  /**
   * 当前项目创建阶段
   *
   * @returns 只读阶段值
   */
  public get stage(): CreateRunnerStage {
    return this._stage
  }

  /**
   * 合并默认值、构造选项和用户配置后的最终配置
   *
   * @remarks
   * 插件初始化阶段只能注册 Hook，最终配置会在全部插件加载完成后解析
   *
   * @returns 已解析的 create 配置
   * @throws {@link PluginHostError}
   * 当配置尚未解析时抛出
   */
  public get config(): ResolvedConfig {
    if (!this._config) {
      throw new PluginHostError(
        PluginHostErrorCode.InvalidState,
        `CreateRunner.config is unavailable before the \`${CreateRunnerStage.ResolvingConfig}\` stage completes.`,
        { details: { stage: this._stage } },
      )
    }

    return this._config
  }

  /**
   * 项目生成使用的路径集合
   *
   * @remarks
   * `modifyPaths` Hook 执行期间应通过其 `memo` 入参访问正在收集的路径
   *
   * @returns 已完成收集的项目路径
   * @throws {@link PluginHostError} `modifyPaths` Hook 尚未完成时抛出
   */
  public get paths(): Paths {
    return this._requireRuntimeData(this._paths, 'paths', 'modifyPaths')
  }

  /**
   * 插件共同维护的项目元数据
   *
   * @remarks
   * `modifyAppData` Hook 执行期间应通过其 `memo` 入参访问正在收集的数据
   *
   * @returns 已完成收集的项目元数据
   * @throws {@link PluginHostError} `modifyAppData` Hook 尚未完成时抛出
   */
  public get appData(): AppData {
    return this._requireRuntimeData(this._appData, 'appData', 'modifyAppData')
  }

  /**
   * 用户交互输入
   *
   * @remarks
   * `modifyPrompts` Hook 执行期间应通过其 `memo` 入参访问正在收集的输入
   *
   * @returns 已完成收集的用户输入
   * @throws {@link PluginHostError} `modifyPrompts` Hook 尚未完成时抛出
   */
  public get prompts(): Prompts {
    return this._requireRuntimeData(this._prompts, 'prompts', 'modifyPrompts')
  }

  /**
   * 创建项目生成运行器
   *
   * @param options - 模版工作目录、create 配置、preset 和 plugin 声明
   */
  public constructor(options: CreateRunnerOptions) {
    super(
      {
        ...options,
        defaultConfigFiles: ['create.config.ts', 'create.config.js'],
        presets: [
          resolveInternalModule('../internal/index', currentModulePath),
          ...(options.presets || []),
        ],
        plugins: options.plugins,
      },
      createHookSchema,
    )
  }

  /**
   * 加载插件并依次执行项目生成生命周期
   *
   * @param target - 项目输出目标路径
   * @param projectName - 项目名称
   * @returns 项目生成流程完成后兑现的 Promise
   */
  public async run(target: string, projectName: string): Promise<void> {
    if (this._stage !== CreateRunnerStage.Uninitialized) {
      throw new PluginHostError(
        PluginHostErrorCode.InvalidState,
        `CreateRunner.run() can only be called once from the \`${CreateRunnerStage.Uninitialized}\` stage, current stage is \`${this._stage}\`.`,
        { details: { stage: this._stage } },
      )
    }

    const disposeRequireHook = installRequireHook()

    try {
      this._stage = CreateRunnerStage.LoadingPlugins
      await this.load()

      this._stage = CreateRunnerStage.ResolvingConfig
      await this._resolveConfig()

      this._stage = CreateRunnerStage.CollectingPaths
      this._paths = await this.runHook('modifyPaths', {
        initialValue: {
          cwd: this.cwd,
          target,
        },
        args: {
          cwd: this.cwd,
        },
      })

      this._stage = CreateRunnerStage.CollectingAppData
      this._appData = await this.runHook('modifyAppData', {
        initialValue: {
          scene: 'web',
          cliVersion: localRequire('../../package.json').version,
          pkg: {},
          projectName,
          packageManager: 'pnpm',
        },
        args: {
          cwd: this.cwd,
        },
      })

      this._stage = CreateRunnerStage.CollectingPrompts
      const questions = await this.runHook('addQuestions', {
        initialValue: [],
        args: { cwd: this.cwd },
      })

      this._prompts = await this.runHook('modifyPrompts', {
        initialValue: {
          author: '',
          email: '',
          gitUrl: '',
          gitHref: '',
          registry: '',
          year: '',
          date: '',
          dateTime: '',
        },
        args: { questions },
      })

      this._stage = CreateRunnerStage.GeneratingFiles
      await this.runHook('onStart')

      await this.runHook('onBeforeGenerateFiles', {
        args: {
          prompts: this.prompts,
          paths: this.paths,
        },
      })

      await this.runHook('onGenerateFiles', {
        args: {
          prompts: this.prompts,
          paths: this.paths,
        },
      })

      await this.runHook('onGenerateDone')
      this._stage = CreateRunnerStage.Completed
    } catch (error) {
      this._stage = CreateRunnerStage.Failed
      throw error
    } finally {
      disposeRequireHook()
    }
  }

  /**
   * 合并默认配置、构造选项和用户配置
   *
   * @returns 配置解析完成后兑现的 Promise
   */
  private async _resolveConfig(): Promise<void> {
    const { signal: constructorSignal, ...constructorOptions } =
      this.constructorOptions
    const { signal: userSignal, ...userConfig } = this.userConfig || {}
    const config = deepMerge(
      {},
      defaultConfig,
      userConfig,
      constructorOptions,
    ) as ResolvedConfig

    // AbortSignal 依赖原型和内部状态，不能交给通用深合并器克隆
    config.signal = constructorSignal || userSignal
    this._config = config
  }

  private _requireRuntimeData<T>(
    value: T | null,
    property: string,
    hook: string,
  ): T {
    if (value === null) {
      throw new PluginHostError(
        PluginHostErrorCode.InvalidState,
        `CreateRunner.${property} is unavailable before the \`${hook}\` hook completes.`,
        { details: { stage: this._stage } },
      )
    }

    return value
  }

  /**
   * 为 create 插件上下文提供运行时数据视图
   *
   * @returns 只读访问当前 CreateRunner 数据的插件能力
   */
  protected override getPluginContextExtensions(): CreatePluginCapabilities {
    const getConfig = () => this.config
    const getAppData = () => this.appData
    const getPaths = () => this.paths as Required<Paths>
    const getPrompts = () => this.prompts

    return {
      get config() {
        return getConfig()
      },
      get appData() {
        return getAppData()
      },
      get paths() {
        return getPaths()
      },
      get prompts() {
        return getPrompts()
      },
    }
  }
}
