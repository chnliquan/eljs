import {
  Service,
  type ApplyAdd,
  type ApplyEvent,
  type ApplyModify,
  type Paths,
  type ServiceOpts,
  type ServicePluginAPI,
} from '@eljs/service'
import type { PkgJSON, RenderTemplateOpts } from '@eljs/utils'
import { prompts } from '@eljs/utils'
import {
  GenerateServiceStage,
  type AppData,
  type CopyDirectoryOpts,
  type CopyFileOpts,
  type CopyTplOpts,
  type ExtendPackageOpts,
  type GeneratePluginConfig,
  type Prompts,
} from '../types'
export interface GenerateServiceOpts extends ServiceOpts {
  /**
   * 是否生成 schema
   */
  isGenSchema?: boolean
}
export declare class GenerateService extends Service {
  /**
   * 构造函数配置项
   */
  opts: GenerateServiceOpts
  /**
   * 执行阶段
   */
  stage: GenerateServiceStage
  /**
   * 插件启用配置，用于控制插件，是否启用可通过 `modifyConfig` 方法修改
   */
  pluginConfig: GeneratePluginConfig
  /**
   * 用户输入
   */
  prompts: Prompts
  /**
   * tsConfig 配置
   */
  tsConfig: any
  /**
   * jestConfig 配置
   */
  jestConfig: any
  /**
   * prettierConfig 配置
   */
  prettierConfig: any
  /**
   * 项目的 package.json 对象
   */
  pkgJSON: PkgJSON
  /**
   * cli版本
   */
  cliVersion: string
  constructor(opts: GenerateServiceOpts)
  protected beforeRunCommand(): Promise<void>
  protected afterRun(): Promise<void>
  protected proxyPluginAPIPropsExtractor(): {
    serviceProps: string[]
    staticProps: {
      Stage: typeof GenerateServiceStage
    }
  }
}
export interface GenerateServicePluginAPI extends ServicePluginAPI {
  /**
   * 存储项目相关全局数据
   */
  appData: AppData
  /**
   * 存储项目相关路径
   */
  paths: Required<typeof GenerateService.prototype.paths>
  /**
   * 用户输入的命令行提示
   */
  prompts: typeof GenerateService.prototype.prompts
  /**
   * tsConfig 配置
   */
  tsConfig: typeof GenerateService.prototype.tsConfig
  /**
   * jestConfig 配置
   */
  jestConfig: typeof GenerateService.prototype.jestConfig
  /**
   * prettierConfig 配置
   */
  prettierConfig: typeof GenerateService.prototype.prettierConfig
  /**
   * 插件启用配置，用于控制插件，是否启用可通过 `modifyPluginConfig` 方法修改
   */
  pluginConfig: typeof GenerateService.prototype.pluginConfig
  /**
   * 命令行版本
   */
  cliVersion: string
  /**
   * 修改用户业务配置，用于控制插件启用或者其它业务逻辑
   */
  modifyPluginConfig: ApplyModify<GeneratePluginConfig, null>
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
    {
      questions: prompts.PromptObject[]
    }
  >
  /**
   * 修改 tsConfig
   */
  modifyTSConfig: ApplyModify<typeof GenerateService.prototype.tsConfig, null>
  /**
   * 修改 jestConfig
   */
  modifyJestConfig: ApplyModify<
    typeof GenerateService.prototype.jestConfig,
    null
  >
  /**
   * 修改 prettierConfig
   */
  modifyPrettierConfig: ApplyModify<
    typeof GenerateService.prototype.prettierConfig,
    null
  >
  /**
   * 添加命令行问询
   */
  addQuestions: ApplyAdd<
    {
      cwd: string
    },
    prompts.PromptObject[]
  >
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
  onGenerateFiles: ApplyEvent<{
    prompts: Record<string, any>
    paths: Paths
  }>
  /**
   * 生成文件完成事件
   */
  onGenerateDone: ApplyEvent<null>
  /**
   * 拷贝文件
   */
  copyFile: (opts: CopyFileOpts) => void
  /**
   * 拷贝模版
   */
  copyTpl: (opts: CopyTplOpts) => void
  /**
   * 拷贝文件夹
   */
  copyDirectory: (opts: CopyDirectoryOpts) => void
  /**
   * 将模板文件渲染到目标文件对象中
   */
  render: (
    path: string,
    data: Record<string, any>,
    opts?: RenderTemplateOpts,
  ) => Promise<void>
  /**
   * 扩展 package.json
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
  /**
   * 服务执行阶段类型枚举
   */
  Stage: typeof GenerateServiceStage
}
//# sourceMappingURL=service.d.ts.map
