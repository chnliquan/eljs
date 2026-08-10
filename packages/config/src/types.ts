/**
 * 配置合并函数
 *
 * @remarks
 * 每个后加载配置都会作为 `overrideConfig` 传入，返回值必须与调用方声明的配置类型兼容且不应修改任一输入对象
 * TypeScript 无法从运行时回调验证这一兼容性，实现者需要在回调内保证字段契约
 *
 * @param baseConfig - 已合并的基础配置
 * @param overrideConfig - 当前文件加载出的覆盖配置
 * @returns 与调用方配置类型兼容的合并结果对象
 */
export type ConfigMerge = (baseConfig: object, overrideConfig: object) => object

/**
 * 配置验证时提供的来源上下文
 */
export interface ConfigValidationContext {
  /** 按调用方声明顺序排列的输入配置文件，包含不存在或内容为空的文件 */
  readonly configFiles: readonly string[]
  /** 按合并顺序排列且实际产出配置对象的文件 */
  readonly loadedConfigFiles: readonly string[]
}

/**
 * 配置验证函数
 *
 * @remarks
 * 验证在所有文件与默认配置合并后同步执行，可返回与调用方声明类型兼容的清洗对象，不支持返回 Promise
 * TypeScript 无法从运行时回调验证这一兼容性，实现者需要在回调内保证字段契约
 *
 * @param config - 完成合并的配置对象
 * @param context - 输入文件与实际加载文件上下文
 * @returns 验证通过或与调用方配置类型兼容的清洗对象
 * @throws 验证失败时抛出包含原因的异常
 */
export type ConfigValidator = (
  config: object,
  context: ConfigValidationContext,
) => object

/**
 * 控制配置合并与最终验证的加载选项
 */
export interface ConfigLoadOptions {
  /** 自定义合并函数，默认使用数组拼接的深度合并 */
  merge?: ConfigMerge
  /**
   * 异步加载 JavaScript 入口模块时绕过 Node.js 模块缓存
   *
   * @remarks
   * 只重新求值入口模块，其传递依赖仍遵循 Node.js 缓存；每次重新加载 ESM 入口都会创建新的模块实例，应只在开发或受控刷新流程中启用
   */
  reload?: boolean
  /** 所有配置合并完成后执行的同步验证函数 */
  validate?: ConfigValidator
}

/**
 * 配置管理器构造选项
 */
export interface ConfigManagerOptions extends ConfigLoadOptions {
  /**
   * 按优先级排列的主配置候选文件，只加载第一个存在的文件
   *
   * @example
   * ['config.ts', 'config.js']
   */
  defaultConfigFiles: readonly string[]
  /**
   * 按加载顺序排列的环境配置后缀
   *
   * @example
   * `['dev', 'staging'] => ['config.dev.ts', 'config.staging.ts']`
   */
  defaultConfigExts?: readonly string[]
  /**
   * 相对候选文件的解析基准
   *
   * @defaultValue process.cwd()
   */
  cwd?: string
}
