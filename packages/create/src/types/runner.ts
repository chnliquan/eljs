import type { PackageJson, PackageManager } from '@eljs/utils'

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
 * 应用数据
 */
export interface AppData {
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
  /**
   * 扩展字段
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [property: string]: any
}

/**
 * 命令行输入
 */
export interface Prompts {
  /**
   * 项目作者
   */
  author: string
  /**
   * 邮箱
   */
  email: string
  /**
   * git url 地址，git@github.com:chnliquan/eljs.git
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
  /**
   * 扩展字段
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [property: string]: any
}

/**
 * 生成器阶段枚举
 */
export enum RunnerStageEnum {
  Uninitialized = 'uninitialized',
  Init = 'init',
  CollectAppData = 'collectAppData',
  CollectPluginConfig = 'collectPluginConfig',
  CollectPrompts = 'collectPrompts',
  CollectTsConfig = 'collectTsConfig',
  CollectJestConfig = 'collectJestConfig',
  CollectPrettierConfig = 'collectPrettierConfig',
  OnStart = 'onStart',
}
