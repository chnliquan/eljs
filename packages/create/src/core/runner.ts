import {
  RunnerStageEnum,
  type AppData,
  type Paths,
  type Prompts,
} from '@/types'
import {
  Pluggable,
  type ApplyAdd,
  type ApplyEvent,
  type ApplyModify,
  type PluggableOptions,
  type PluggablePluginAPI,
  type UserConfig,
} from '@eljs/pluggable'
import utils, { prompts, type PkgJSON } from '@eljs/utils'

/**
 * 运行器插件自身配置项
 */
export interface RunnerPluginConfig {
  /**
   * 是否启用默认问询
   */
  defaultQuestions?: boolean
  /**
   * 是否启用 git 初始化
   */
  gitInit?: boolean
}

/**
 * 运行器
 */
export class Runner extends Pluggable<
  PluggableOptions,
  UserConfig,
  RunnerPluginConfig
> {
  /**
   * 执行阶段
   */
  public stage = RunnerStageEnum.Uninitialized
  /**
   * 项目路径
   */
  public paths: Paths = {
    cwd: '',
    target: '',
  }
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
  /**
   * 项目的 package.json 对象
   */
  public pkgJSON: PkgJSON = Object.create(null)

  public constructor(options: PluggableOptions) {
    super({
      ...options,
      defaultConfigFiles: ['.create.ts', '.create.js'],
      presets: [require.resolve('../internal'), ...(options.presets || [])],
      plugins: options.plugins,
    })
  }

  public async run(target: string, projectName: string): Promise<void> {
    this.load()
    this.stage = RunnerStageEnum.Init

    const questions = await this.applyPlugins('addQuestions', {
      initialValue: [],
      args: { cwd: this.cwd },
    })

    this.paths = await this.applyPlugins('modifyPaths', {
      initialValue: {
        cwd: this.cwd,
        target,
      },
      args: {
        cwd: this.cwd,
      },
    })

    this.appData = await this.applyPlugins('modifyAppData', {
      initialValue: {
        scene: 'web',
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        cliVersion: require('../../package.json').version,
        pkgJSON: {},
        projectName,
        packageManager: 'pnpm',
      },
      args: {
        cwd: this.cwd,
      },
    })

    this.pluginConfig = await this.applyPlugins('modifyPluginConfig', {
      initialValue: this.pluginConfig,
      args: {},
    })

    this.stage = RunnerStageEnum.Prompting
    this.prompts = await this.applyPlugins('modifyPrompts', {
      initialValue: {} as Prompts,
      args: { questions },
    })

    // 修改 tsConfig
    this.tsConfig = await this.applyPlugins('modifyTSConfig', {
      initialValue: {},
    })

    // 修改 jestConfig
    this.jestConfig = await this.applyPlugins('modifyJestConfig', {
      initialValue: {},
    })

    // 修改 prettierConfig
    this.prettierConfig = await this.applyPlugins('modifyPrettierConfig', {
      initialValue: {},
    })

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
}

/**
 * 运行器插件 API
 */
export interface RunnerPluginAPI extends PluggablePluginAPI {
  // #region 插件 API 属性
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
   * tsConfig 配置，可通过 `modifyTSConfig` 方法修改
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
  /**
   * 插件启用配置，可通过 `modifyPluginConfig` 方法修改
   */
  pluginConfig: typeof Runner.prototype.pluginConfig
  /**
   *
   */
  pkgJSON: typeof Runner.prototype.pkgJSON
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
  modifyTSConfig: ApplyModify<typeof Runner.prototype.tsConfig, null>
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
   * 修改插件启用配置
   */
  modifyPluginConfig: ApplyModify<RunnerPluginConfig, null>
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onGenerateFiles: ApplyEvent<{ prompts: Record<string, any>; paths: Paths }>
  /**
   * 生成文件完成事件
   */
  onGenerateDone: ApplyEvent<null>
  // #endregion

  // #region 静态属性
  /**
   * 工具函数
   */
  utils: typeof utils
  // #endregion
}
