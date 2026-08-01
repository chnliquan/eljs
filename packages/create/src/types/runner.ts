import type { PackageJson, PackageManager } from '@eljs/utils/types'

/**
 * 项目路径
 */
export interface Paths {
  /**
   * 当前工作目录
   */
  cwd: string
  /**
   * 目标路径
   */
  target: string
  /**
   * 扩展字段
   */
  [property: string]: string
}

/**
 * 应用数据及插件扩展字段
 *
 * @typeParam Extensions - 插件声明的额外应用数据字段
 */
export type AppData<
  Extensions extends Record<string, unknown> = Record<string, unknown>,
> = {
  /**
   * 场景
   */
  scene: 'node' | 'web'
  /**
   * 当前 Cli 版本
   */
  cliVersion: string
  /**
   * package.json 对象
   */
  pkg: PackageJson
  /**
   * 项目名
   */
  projectName: string
  /**
   * 包管理器
   */
  packageManager: PackageManager
} & Extensions

/**
 * 命令行输入及插件扩展字段
 *
 * @typeParam Extensions - 插件声明的额外交互结果字段
 */
export type Prompts<
  Extensions extends Record<string, unknown> = Record<string, unknown>,
> = {
  /**
   * 项目作者
   */
  author: string
  /**
   * 邮箱
   */
  email: string
  /**
   * git url 地址，`git@github.com:chnliquan/eljs.git`
   */
  gitUrl: string
  /**
   * git href 地址，https://github.com/chnliquan/eljs
   */
  gitHref: string
  /**
   * npm 仓库源
   */
  registry: string
  /**
   * 创建时对应的年，YYYY
   */
  year: string
  /**
   * 创建时对应的日期，YYYY-MM-DD
   */
  date: string
  /**
   * 创建时对应的时间，YYYY-MM-DD hh:mm:ss
   */
  dateTime: string
  /**
   * 创建时使用的文件夹名称
   */
  dirname: string
} & Extensions

/**
 * 生成器阶段枚举
 */
export enum CreateRunnerStage {
  /**
   * 尚未运行
   */
  Uninitialized = 'uninitialized',
  /**
   * 正在加载插件
   */
  LoadingPlugins = 'loadingPlugins',
  /**
   * 正在解析配置
   */
  ResolvingConfig = 'resolvingConfig',
  /**
   * 正在解析路径
   */
  CollectingPaths = 'collectingPaths',
  /**
   * 正在收集项目数据
   */
  CollectingAppData = 'collectingAppData',
  /**
   * 正在收集交互输入
   */
  CollectingPrompts = 'collectingPrompts',
  /**
   * 正在收集 TypeScript 配置
   */
  CollectingTsConfig = 'collectingTsConfig',
  /**
   * 正在收集 Jest 配置
   */
  CollectingJestConfig = 'collectingJestConfig',
  /**
   * 正在收集 Prettier 配置
   */
  CollectingPrettierConfig = 'collectingPrettierConfig',
  /**
   * 正在生成文件
   */
  GeneratingFiles = 'generatingFiles',
  /**
   * 运行完成
   */
  Completed = 'completed',
  /**
   * 运行失败
   */
  Failed = 'failed',
}
