/* eslint-disable @typescript-eslint/no-var-requires */
import {
  ApplyAdd,
  ApplyEvent,
  ApplyModify,
  Service,
  ServiceOpts,
  ServicePluginAPI,
} from '@eljs/service'
import utils, { logger, prompts } from '@eljs/utils'
import { AppData, GenerateConfig, GenerateServiceStage, Paths } from '../types'

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
  public opts: GenerateServiceOpts
  /**
   * 目标路径
   */
  public target = ''
  /**
   * 其它执行参数
   */
  public args: Record<string, any> = {}
  /**
   * 存储全局数据
   */
  public appData: AppData = {}
  /**
   * 存储项目路径
   */
  public paths: Paths = {}
  /**
   * 执行阶段
   */
  public stage = GenerateServiceStage.uninitialized
  /**
   * 插件启用配置，用于控制插件，是否启用可通过 `modifyConfig` 方法修改
   */
  public config: GenerateConfig = {}
  /**
   * 用户输入
   */
  public prompts: Record<string, any> = {}
  /**
   * 项目的 package.json 对象
   */
  public pkg: Record<string, any> = {}
  /**
   * cli版本
   */
  public cliVersion = ''

  public constructor(opts: GenerateServiceOpts) {
    super(opts)
    this.opts = opts
    this.cliVersion = require('../../package.json').version
  }

  public async run(opts: { target: string; args?: any }) {
    const { presets, plugins } = await this.getPresetsAndPlugins()
    const { target, args } = opts

    // 修改业务配置
    this.config = await this.applyPlugins({
      key: 'modifyConfig',
      initialValue: this.config,
      args: {},
    })

    this.stage = GenerateServiceStage.prompting

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

    // 修改项目路径
    this.paths = await this.applyPlugins({
      key: 'modifyPaths',
      initialValue: {
        absOutputPath: target,
      },
      args: {
        cwd: this.cwd,
        args,
      },
    })

    // applyPlugin collect app data
    this.stage = GenerateServiceStage.collectAppData
    this.appData = await this.applyPlugins({
      key: 'modifyAppData',
      initialValue: {
        cwd: this.cwd,
        plugins,
        presets,
      },
    })

    // applyPlugin onCheck
    this.stage = GenerateServiceStage.onCheck
    await this.applyPlugins({
      key: 'onCheck',
    })

    // applyPlugin onStart
    this.stage = GenerateServiceStage.onStart
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
      staticProps: {},
    })
  }
}

export interface GenerateServicePluginAPI extends ServicePluginAPI {
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
   * 插件启用配置，用于控制插件，是否启用可通过 `modifyConfig` 方法修改
   */
  config: typeof GenerateService.prototype.config
  /**
   * 工具函数
   */
  utils: typeof utils
  /**
   * 转换文件前缀 处理文件名的边界情况
   */
  convertFilePrefix: (rawPath: string) => string
  /**
   * 将文件从模板文件复制到目录文件
   */
  copyTpl: (opts: any) => void
  /**
   * 将文件夹从模板文件夹复制到目标文件夹
   */
  copyDirectory: (opts: any) => void
  /**
   * 复制文件
   */
  copyFile: (opts: any) => void
  /**
   * 将模板文件渲染到目标文件对象中
   */
  render: (path: string, args?: Record<string, any>) => void
  /**
   * 更新 package.json
   */
  extendPackage: (fields: Record<string, any>) => void
  /**
   * 安装依赖
   */
  installDeps: () => void
  /**
   * 修改用户业务配置，用于控制插件启用或者其它业务逻辑
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

  /**
   * 服务执行阶段类型枚举
   */
  Stage: typeof GenerateServiceStage
}
