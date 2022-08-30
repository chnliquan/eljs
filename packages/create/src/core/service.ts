import {
  ApplyAdd,
  ApplyEvent,
  ApplyModify,
  Paths,
  Service,
  ServiceOpts,
  ServicePluginAPI,
} from '@eljs/service'
import * as utils from '@eljs/utils'
import { logger, PkgJSON, prompts, RenderTemplateOptions } from '@eljs/utils'
import {
  CopyDirectory,
  CopyFileOpts,
  CopyTplOpts,
  ExtendPackageOpts,
  GenerateConfig,
  GenerateServiceStage,
  Prompts,
} from '../types'
import { getPresetsAndPlugins } from './config'

export interface GenerateServiceOpts extends ServiceOpts {
  /**
   * 是否生成 schema
   */
  isGenSchema?: boolean
}

export class GenerateService extends Service {
  /**
   * 构造函数配置项
   */
  public opts!: GenerateServiceOpts
  /**
   * 目标路径
   */
  public target = ''
  /**
   * 其它执行参数
   */
  public args: Record<string, any> = Object.create(null)
  /**
   * 执行阶段
   */
  public stage = GenerateServiceStage.Uninitialized
  /**
   * 插件启用配置，用于控制插件，是否启用可通过 `modifyConfig` 方法修改
   */
  public config: GenerateConfig = Object.create(null)
  /**
   * 用户输入
   */
  public prompts: Prompts = Object.create(null)
  /**
   * 项目的 package.json 对象
   */
  public pkgJSON: PkgJSON = Object.create(null)
  /**
   * cli版本
   */
  public cliVersion = ''

  public constructor(opts: GenerateServiceOpts) {
    const { presets, plugins } = getPresetsAndPlugins(opts.cwd)

    super({
      ...opts,
      presets: [require.resolve('../internal'), ...presets],
      plugins: [...plugins],
    })
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    this.cliVersion = require('../../package.json').version
  }

  public async run(opts: { target: string; args?: Record<string, any> }) {
    await super.run(opts)

    this.stage = GenerateServiceStage.Prompting

    const questions = await this.applyPlugins({
      key: 'addQuestions',
      initialValue: [],
      args: { cwd: this.cwd },
    })

    // 是否生成 schema 用于 vscode 创建项目使用
    if (this.opts.isGenSchema) {
      await this.applyPlugins({
        key: 'onGenerateSchema',
        args: {
          questions,
        },
      })
    }

    // 修改用户提示
    this.prompts = await this.applyPlugins({
      key: 'modifyPrompts',
      initialValue: {},
      args: { questions },
    })

    // applyPlugin onCheck
    this.stage = GenerateServiceStage.OnCheck
    await this.applyPlugins({
      key: 'onCheck',
    })

    // applyPlugin onStart
    this.stage = GenerateServiceStage.OnStart
    await this.applyPlugins({
      key: 'onStart',
    })

    // 生成文件之前
    await this.applyPlugins({
      key: 'onBeforeGenerateFiles',
      args: {
        prompts: this.prompts,
        paths: this.paths,
      },
    })

    // 生成 schema 不做 文件生成
    if (this.opts.isGenSchema) {
      logger.info('跳过文件生成, 仅生成 schema')
      return
    }

    await this.applyPlugins({
      key: 'onGenerateFiles',
      args: {
        prompts: this.prompts,
        paths: this.paths,
      },
    })

    await this.applyPlugins({
      key: 'onGenerateDone',
    })
  }

  protected getProxyProps() {
    return super.getProxyProps({
      serviceProps: ['target', 'args', 'paths', 'appData', 'prompts', 'config'],
      staticProps: {
        utils,
        Stage: GenerateServiceStage,
      },
    })
  }
}

export interface GenerateServicePluginAPI extends ServicePluginAPI {
  // #region 服务自身属性
  /**
   * 目标路径
   */
  target: typeof GenerateService.prototype.target
  /**
   * 其它执行参数
   */
  args: typeof GenerateService.prototype.args
  /**
   * 存储全局数据
   */
  appData: typeof GenerateService.prototype.appData
  /**
   * 项目路径
   */
  paths: Required<typeof GenerateService.prototype.paths>
  /**
   * 用户输入的命令行提示
   */
  prompts: typeof GenerateService.prototype.prompts
  /**
   * 插件启用配置，用于控制插件，是否启用可通过 `modifyConfig` 方法修改
   */
  config: typeof GenerateService.prototype.config
  /**
   * 命令行版本
   */
  cliVersion: string
  // #endregion

  // #region 插件钩子
  /**
   * 修改用户业务配置，用于控制插件启用或者其它业务逻辑
   */
  modifyConfig: ApplyModify<GenerateConfig, null>
  /**
   * 修改项目路径
   */
  modifyPaths: ApplyModify<typeof GenerateService.prototype.paths, null>
  /**
   * 修改应用数据
   */
  modifyAppData: ApplyModify<typeof GenerateService.prototype.appData, null>
  /**
   * 修改用户输入数据
   */
  modifyPrompts: ApplyModify<
    typeof GenerateService.prototype.prompts,
    { questions: prompts.PromptObject[] }
  >
  /**
   * 添加命令行问询
   */
  addQuestions: ApplyAdd<{ cwd: string }, prompts.PromptObject[]>
  /**
   * 生成 Schema 事件
   */
  onGenerateSchema: ApplyEvent<{ questions: prompts.PromptObject[] }>
  /**
   * 生成文件之前事件
   */
  onBeforeGenerateFiles: ApplyEvent<{
    prompts: Record<string, any>
    paths: Paths
  }>
  /**
   * 生成文件事件
   */
  onGenerateFiles: ApplyEvent<{ prompts: Record<string, any>; paths: Paths }>
  /**
   * 生成文件完成事件
   */
  onGenerateDone: ApplyEvent<null>
  // #endregion

  // #region 插件工具方法
  /**
   * 转换文件前缀 处理文件名的边界情况
   */
  convertFilePrefix: (rawPath: string) => string
  /**
   * 复制文件
   */
  copyFile: (opts: CopyFileOpts) => void
  /**
   * 将文件从模板文件复制到目录文件
   */
  copyTpl: (opts: CopyTplOpts) => void
  /**
   * 将文件夹从模板文件夹复制到目标文件夹
   */
  copyDirectory: (opts: CopyDirectory) => void
  /**
   * 将模板文件渲染到目标文件对象中
   */
  render: (
    path: string,
    data: Record<string, any>,
    opts?: RenderTemplateOptions,
  ) => Promise<void>
  /**
   * 更新 package.json
   */
  extendPackage: (opts: ExtendPackageOpts) => void
  /**
   * 在当前工程下解析一个路径
   */
  resolve: (...paths: string[]) => string
  /**
   * 安装依赖
   */
  installDeps: () => void
  // #endregion

  // #region 静态属性
  /**
   * 服务执行阶段类型枚举
   */
  Stage: typeof GenerateServiceStage
  // #endregion
}
