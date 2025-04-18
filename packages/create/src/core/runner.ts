import { defaultConfig } from '@/default'
import {
  RunnerStageEnum,
  type AppData,
  type Config,
  type Paths,
  type Prompts,
} from '@/types'
import {
  Pluggable,
  type ApplyAdd,
  type ApplyEvent,
  type ApplyModify,
  type PluggableOptions,
  type PluggablePluginApi,
} from '@eljs/pluggable'
import { deepMerge, prompts, type RequiredRecursive } from '@eljs/utils'

/**
 * 运行器
 */
export class Runner extends Pluggable<Config> {
  /**
   * 配置项
   */
  public config!: RequiredRecursive<Config>
  /**
   * 执行阶段
   */
  public stage = RunnerStageEnum.Uninitialized
  /**
   * 项目路径
   */
  public paths: Paths = Object.create(null)
  /**
   * 应用数据
   */
  public appData: AppData = Object.create(null)
  /**
   * 命令行输入
   */
  public prompts: Prompts = Object.create(null)
  /**
   * tsConfig 配置
   */
  public tsConfig = Object.create(null)
  /**
   * jestConfig 配置
   */
  public jestConfig = Object.create(null)
  /**
   * prettierConfig 配置
   */
  public prettierConfig = Object.create(null)

  public constructor(options: Omit<PluggableOptions, 'defaultConfigFiles'>) {
    super({
      ...options,
      defaultConfigFiles: ['create.config.ts', 'create.config.js'],
      presets: [require.resolve('../internal'), ...(options.presets || [])],
      plugins: options.plugins,
    })
  }

  public async run(target: string, projectName: string): Promise<void> {
    await this.load()
    await this._resolveConfig()

    this.paths = await this.applyPlugins('modifyPaths', {
      initialValue: {
        cwd: this.cwd,
        target,
      },
      args: {
        cwd: this.cwd,
      },
    })

    this.stage = RunnerStageEnum.CollectAppData
    this.appData = await this.applyPlugins('modifyAppData', {
      initialValue: {
        scene: 'web',
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        cliVersion: require('../../package.json').version,
        pkg: {},
        projectName,
        packageManager: 'pnpm',
      },
      args: {
        cwd: this.cwd,
      },
    })

    const questions = await this.applyPlugins('addQuestions', {
      initialValue: [],
      args: { cwd: this.cwd },
    })

    this.prompts = await this.applyPlugins('modifyPrompts', {
      initialValue: {} as Prompts,
      args: { questions },
    })

    this.stage = RunnerStageEnum.CollectTsConfig
    this.tsConfig = await this.applyPlugins('modifyTsConfig', {
      initialValue: {},
    })

    this.stage = RunnerStageEnum.CollectJestConfig
    this.jestConfig = await this.applyPlugins('modifyJestConfig', {
      initialValue: {},
    })

    this.stage = RunnerStageEnum.CollectPrettierConfig
    this.prettierConfig = await this.applyPlugins('modifyPrettierConfig', {
      initialValue: {},
    })

    this.stage = RunnerStageEnum.OnStart
    await this.applyPlugins('onStart')

    await this.applyPlugins('onBeforeGenerateFiles', {
      args: {
        prompts: this.prompts,
        paths: this.paths,
      },
    })

    await this.applyPlugins('onGenerateFiles', {
      args: {
        prompts: this.prompts,
        paths: this.paths,
      },
    })

    await this.applyPlugins('onGenerateDone')
  }

  private async _resolveConfig() {
    this.config = deepMerge(
      {},
      defaultConfig,
      this.constructorOptions,
      this.userConfig || {},
    ) as RequiredRecursive<Config>
  }
}

/**
 * 运行器插件 Api
 */
export interface RunnerPluginApi extends PluggablePluginApi {
  // #region 插件 Api 属性
  /**
   * 用户配置
   */
  config: typeof Runner.prototype.config
  /**
   * 应用数据，可通过 `modifyAppData` 方法修改
   */
  appData: typeof Runner.prototype.appData
  /**
   * 项目路径，可通过 `modifyPaths` 方法修改
   */
  paths: Required<typeof Runner.prototype.paths>
  /**
   * 命令行输入，可通过 `modifyPrompts` 方法修改
   */
  prompts: typeof Runner.prototype.prompts
  /**
   * tsConfig 配置，可通过 `modifyTsConfig` 方法修改
   */
  tsConfig: typeof Runner.prototype.tsConfig
  /**
   * jestConfig 配置，可通过 `modifyJestConfig` 方法修改
   */
  jestConfig: typeof Runner.prototype.jestConfig
  /**
   * prettierConfig 配置，可通过 `modifyPrettierConfig` 方法修改
   */
  prettierConfig: typeof Runner.prototype.prettierConfig
  // #endregion

  // #region 插件钩子
  /**
   * 添加命令行问询
   */
  addQuestions: ApplyAdd<{ cwd: string }, prompts.PromptObject[]>
  /**
   * 修改项目路径
   */
  modifyPaths: ApplyModify<typeof Runner.prototype.paths, null>
  /**
   * 修改应用数据
   */
  modifyAppData: ApplyModify<typeof Runner.prototype.appData, null>
  /**
   * 修改命令行输入数据
   */
  modifyPrompts: ApplyModify<
    typeof Runner.prototype.prompts,
    { questions: prompts.PromptObject[] }
  >
  /**
   * 修改 tsConfig
   */
  modifyTsConfig: ApplyModify<typeof Runner.prototype.tsConfig, null>
  /**
   * 修改 jestConfig
   */
  modifyJestConfig: ApplyModify<typeof Runner.prototype.jestConfig, null>
  /**
   * 修改 prettierConfig
   */
  modifyPrettierConfig: ApplyModify<
    typeof Runner.prototype.prettierConfig,
    null
  >
  /**
   * 应用启动事件
   */
  onStart: ApplyEvent<null>
  /**
   * 生成文件之前事件
   */
  onBeforeGenerateFiles: ApplyEvent<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prompts: Record<string, any>
    paths: Paths
  }>
  /**
   * 生成文件事件
   */
  onGenerateFiles: ApplyEvent<// eslint-disable-next-line @typescript-eslint/no-explicit-any
  { prompts: Record<string, any>; paths: Paths }>
  /**
   * 生成文件完成事件
   */
  onGenerateDone: ApplyEvent<null>
  // #endregion
}
