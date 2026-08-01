import type { UserConfig } from '@eljs/plugin-host'
import type { UtilsRuntime } from '@eljs/utils/observability'
import type { RequiredRecursive } from '@eljs/utils/types'

/**
 * 远程模版来源
 */
export interface RemoteTemplate {
  /**
   * 下载协议
   */
  type: 'npm' | 'git'
  /**
   * npm 包标识或 Git 仓库地址
   */
  value: string
  /**
   * npm 模版使用的仓库地址
   */
  registry?: string
  /**
   * 是否由调用方确认来源可信
   *
   * @remarks
   * 可信模版会跳过远程代码执行确认，调用方必须确保该来源及精确版本受控
   *
   * @defaultValue false
   */
  trusted?: boolean
}

/**
 * 项目创建配置
 */
export interface Config extends UserConfig {
  /**
   * 创建命令的工作目录
   *
   * @defaultValue process.cwd()
   */
  cwd?: string
  /**
   * 用于在下载、插件或生成阶段边界停止后续工作的取消信号
   */
  signal?: AbortSignal
  /**
   * 接收子进程与下载生命周期事件的运行时适配器
   */
  runtime?: UtilsRuntime
  /**
   * 本地模版路径或远程模版来源
   */
  template?: string | RemoteTemplate
  /**
   * 是否覆盖已存在的目标目录
   *
   * @defaultValue false
   */
  force?: boolean
  /**
   * 是否合并已存在的目标目录
   *
   * @remarks
   * 不能与 `force` 同时启用；生成失败时会恢复合并前的目录
   *
   * @defaultValue false
   */
  merge?: boolean
  /**
   * 是否启用默认交互问题
   *
   * @defaultValue true
   */
  defaultQuestions?: boolean
  /**
   * 创建完成后是否初始化 Git 仓库
   *
   * @defaultValue true
   */
  gitInit?: boolean
  /**
   * 创建完成后是否安装项目依赖
   *
   * @defaultValue true
   */
  install?: boolean
  /**
   * 是否跳过执行远程模版前的交互确认
   *
   * @remarks
   * 该选项允许远程模版代码直接参与生成，仅应在来源已由其他机制验证时启用
   *
   * @defaultValue false
   */
  yes?: boolean
  /**
   * 安装远程模版自身依赖时是否允许生命周期脚本
   *
   * @remarks
   * 默认关闭以避免项目生成前执行远程依赖脚本
   *
   * @defaultValue false
   */
  allowTemplateScripts?: boolean
}

/**
 * CreateRunner 完成配置解析后的配置视图
 *
 * @remarks
 * 声明式配置均已补齐默认值，运行时取消信号仍保持可选且保留原始实例
 */
export type ResolvedConfig = RequiredRecursive<
  Omit<Config, 'runtime' | 'signal'>
> &
  Pick<Config, 'runtime' | 'signal'>
