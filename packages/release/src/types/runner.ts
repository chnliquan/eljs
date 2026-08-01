import type { PackageJson, PackageManager } from '@eljs/utils'

/**
 * 根项目清单中发布流程依赖的最小字段
 */
export type ProjectPackageJson = PackageJson & { version: string }

/**
 * workspace 包清单中发布流程依赖的最小字段
 */
export type WorkspacePackageJson = PackageJson & {
  /** workspace 中必须唯一的包名 */
  name: string
  /** 安装失败不阻断消费方安装的运行时依赖 */
  optionalDependencies?: Record<string, string>
}

/**
 * 发布命令需要区分的包管理器运行变体
 *
 * @remarks
 * Yarn Classic 与 Yarn Berry 共用 `PackageManager` 中的 `yarn` 标识，
 * 但发布和仅更新锁文件的命令不同，因此在发布上下文中进一步区分
 */
export type PackageManagerVariant =
  'npm' | 'pnpm' | 'yarn-classic' | 'yarn-berry' | 'bun'

/**
 * 应用数据
 */
export interface AppData {
  /**
   * 当前 Cli 版本
   */
  cliVersion: string
  /**
   * 仓库源
   */
  registry?: string
  /**
   * 当前分支
   */
  branch: string
  /**
   * 最新 tag
   */
  latestTag: string | null
  /**
   * 项目 package.json 路径
   */
  projectPkgJsonPath: string
  /**
   * 项目 package.json 内容
   */
  projectPkg: ProjectPackageJson
  /**
   * 项目中所有包的 package.json 路径
   */
  pkgJsonPaths: string[]
  /**
   * 项目中所有包的 package.json 内容
   */
  pkgs: WorkspacePackageJson[]
  /**
   * 项目中的所有包名
   */
  pkgNames: string[]
  /**
   * 项目中可发布包的路径
   */
  validPkgRootPaths: string[]
  /**
   * 项目中可以发布包的名称
   */
  validPkgNames: string[]
  /**
   * 当前版本已经发布、且本地发布标签指向 HEAD 的包名
   * 仅在恢复一次中断的发布时存在
   */
  existingPkgNames?: string[]
  /**
   * 当前执行是否正在复用已经创建的本地发布提交和标签
   *
   * @remarks
   * 即使上一次执行尚未成功发布任何包，该值也可能为 `true`
   */
  isReleaseRetry?: boolean
  /**
   * 包管理器
   */
  packageManager: PackageManager
  /**
   * 发布流程实际使用的包管理器命令变体
   *
   * @remarks
   * 内置运行器始终设置该值，保持可选是为了兼容自行构造旧版 `AppData` 的插件测试和适配层
   */
  packageManagerVariant?: PackageManagerVariant
  /**
   * 扩展字段
   */
  [property: string]: unknown
}

/**
 * 发布运行器阶段
 */
export enum ReleaseRunnerStage {
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
   * 正在准备发布数据并执行检查
   */
  Preparing = 'preparing',
  /**
   * 正在计算和更新版本
   */
  Versioning = 'versioning',
  /**
   * 正在执行发布
   */
  Releasing = 'releasing',
  /**
   * 运行完成
   */
  Completed = 'completed',
  /**
   * 运行失败
   */
  Failed = 'failed',
}

/**
 * 发布流程失败 Hook 的上下文
 */
export interface ReleaseErrorContext {
  /**
   * 触发失败的原始值
   */
  error: unknown
  /**
   * 失败发生时的运行阶段
   *
   * @remarks
   * 该值保留失败前的阶段，不会被替换为 `failed`
   */
  stage: ReleaseRunnerStage
}
