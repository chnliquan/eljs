/**
 * 受支持的包管理器标识
 *
 * @remarks
 * 取值同时构成 `PackageManager` 模板字符串类型的合法字面量集合，
 * 新增成员会同步扩展该类型与依赖它的调用参数
 */
export enum PackageManagerEnum {
  npm = 'npm',
  yarn = 'yarn',
  pnpm = 'pnpm',
  bun = 'bun',
}

/**
 * 包管理器
 */
export type PackageManager = `${PackageManagerEnum}`

/**
 * package.json exports 字段允许的单个子路径导出值
 *
 * @remarks
 * 递归支持 `import`、`require`、`default` 等条件嵌套，
 * `null` 表示该子路径对外不可用
 */
export type PackageJsonExports =
  | string
  | null
  | {
      [condition: string]: PackageJsonExports
    }

/**
 * package.json 的常用字段子集
 *
 * @remarks
 * 通过索引签名透传未显式声明的字段，
 * 直接承载真实 package.json 解析结果时无需额外断言
 */
export interface PackageJson {
  /** 包名 */
  name?: string
  /** 语义化版本号 */
  version?: string
  /** 是否禁止发布到 registry */
  private?: boolean
  /** 包描述 */
  description?: string
  /** 便于检索的关键词 */
  keywords?: string[]
  /** 项目主页地址 */
  homepage?: string
  /** 问题反馈地址 */
  bugs?:
    | {
        /** 问题反馈页面地址 */
        url?: string
        /** 问题反馈邮箱 */
        email?: string
      }
    | string
  /** 源码仓库地址，支持对象声明或 `github:user/repo` 等简写 */
  repository?:
    | {
        /** 版本控制类型，例如 `git` */
        type: string
        /** 仓库地址 */
        url: string
        /** 仓库内作为包根目录的子目录 */
        directory?: string
      }
    | string
  /** 开源许可证标识 */
  license?: string
  /** 作者信息，支持对象或字符串 */
  author?:
    | string
    | {
        /** 作者名称 */
        name: string
        /** 作者邮箱 */
        email?: string
        /** 作者主页 */
        url?: string
      }
  /** 赞助信息 */
  funding?:
    { type?: string; url: string } | Array<{ type?: string; url: string }>
  /** CommonJS 入口文件路径 */
  main?: string
  /** 包的模块系统，决定 `.js` 文件按 CommonJS 还是 ESM 解析 */
  type?: 'commonjs' | 'module'
  /** 打包工具识别的 ESM 入口文件路径 */
  module?: string
  /** 浏览器环境入口文件路径 */
  browser?: string
  /** 类型声明文件路径 */
  types?: string
  /** `types` 的旧版别名 */
  typings?: string
  /** 现代子路径导出映射，优先级高于 `main`、`module` 等扁平入口 */
  exports?: string | null | Record<string, PackageJsonExports>
  /** 命令名到可执行文件路径的映射，单命令时可传字符串 */
  bin?: Record<string, string> | string
  /** 打包工具 tree-shaking 用的副作用声明 */
  sideEffects?: boolean | string[]
  /** 发布时包含的文件清单 */
  files?: string[]
  /** 允许安装的操作系统，取值如 `darwin`、`linux` */
  os?: string[]
  /** 允许安装的 CPU 架构，取值如 `x64`、`arm64` */
  cpu?: string[]
  /** 生命周期与自定义脚本 */
  scripts?: Record<string, string>

  /** git 提交前任务配置 */
  'lint-staged'?: Record<string, string | string[]>
  /** 运行时依赖及版本范围 */
  dependencies?: Record<string, string>
  /** 开发时依赖及版本范围 */
  devDependencies?: Record<string, string>
  /** 安装失败时不阻断主依赖安装的可选运行时依赖 */
  optionalDependencies?: Record<string, string>
  /** 宿主包运行所需的依赖及版本范围 */
  peerDependencies?: Record<string, string>
  /** peer 依赖的附加元信息，例如是否可选 */
  peerDependenciesMeta?: Record<string, { optional?: boolean }>
  /** 发布时覆盖的配置 */
  publishConfig?: {
    /** 发布使用的 registry 地址 */
    registry?: string
    [properName: string]: string | undefined
  }
  /** 按环境名约束的运行环境版本要求，例如 `node` */
  engines?: {
    [properName: string]: string
  }
  /** registry 标记的废弃说明，存在时安装阶段给出警告 */
  deprecated?: string
  /** workspace 包匹配模式，兼容数组和 Yarn object 两种声明 */
  workspaces?:
    | string[]
    | {
        /** workspace 包匹配模式 */
        packages: string[]
        /** Yarn 专属的组件提升排除声明 */
        nohoist?: string[]
      }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [propName: string]: any
}
