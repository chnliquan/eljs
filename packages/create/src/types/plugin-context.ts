import type { HookRegistrationOptions, PluginContext } from '@eljs/plugin-host'
import type { prompts } from '@eljs/utils/cli'
import type { RunCommandOptions } from '@eljs/utils/cp'
import type { CopyFileOptions, RenderTemplateOptions } from '@eljs/utils/file'
import type { MaybePromise, PackageJson } from '@eljs/utils/types'

import { createHookSchema, type CreatePluginCapabilities } from '../hooks'
import type { AppData, Paths, Prompts } from './runner'

/**
 * create preset 入口接收的上下文
 *
 * @remarks
 * preset 初始化早于普通插件，因此不包含普通插件后续注册的动态 capability
 */
export type CreatePresetContext = PluginContext<
  typeof createHookSchema,
  CreatePluginCapabilities
>

/**
 * create 插件入口接收的完整上下文
 */
export type CreatePluginContext = Omit<
  CreatePresetContext,
  'registerPresets' | 'registerPlugins'
> & {
  // #region 插件工具方法
  /**
   * 拷贝文件
   *
   * @param from - 源文件路径
   * @param to - 目标文件路径
   * @param options - 可选拷贝选项
   * @returns 拷贝完成后兑现的 Promise
   */
  copyFile: (
    from: string,
    to: string,
    options?: CopyFileOptions,
  ) => Promise<void>
  /**
   * 拷贝模板文件
   *
   * @param from - 源文件路径
   * @param to - 目标文件路径
   * @param data - 模板数据
   * @param options - 可选拷贝选项
   * @returns 拷贝完成后兑现的 Promise
   */
  copyTpl: (
    from: string,
    to: string,
    data: object,
    options?: CopyFileOptions,
  ) => Promise<void>
  /**
   * 递归拷贝模板目录
   *
   * @param from - 源目录路径
   * @param to - 目标目录路径
   * @param data - 模板数据
   * @param options - 可选拷贝选项
   * @returns 拷贝完成后兑现的 Promise
   */
  copyDirectory: (
    from: string,
    to: string,
    data: object,
    options?: CopyFileOptions,
  ) => Promise<void>
  /**
   * 渲染模板
   *
   * @param path - 模板路径
   * @param data - 模板数据
   * @param options - 渲染选项
   * @returns 渲染完成后兑现的 Promise
   */
  render: (
    path: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: Record<string, any>,
    options?: RenderTemplateOptions,
  ) => Promise<void>
  /**
   * 使用部分字段扩展 `package.json`
   *
   * @remarks
   * 插件初始化阶段登记的扩展会在交互输入和应用数据就绪后按登记顺序合并
   * 生成阶段登记的扩展会立即合并，并在依赖安装前写入文件
   * 数组字段会按登记顺序追加并去重
   *
   * @param partial - 待合并的 `package.json` 字段
   */
  extendPackage(partial: PackageJson): void
  /**
   * 使用转换函数扩展 `package.json`
   *
   * @remarks
   * 转换函数会在交互输入和应用数据就绪后执行，因此可以读取 `context.prompts` 与 `context.appData`
   * 返回值仍作为部分包配置合并，数组字段会按登记顺序追加并去重
   *
   * @param fn - `package.json` 转换函数
   */
  extendPackage(fn: (memo: PackageJson) => PackageJson): void
  /**
   * 在当前工程下解析路径
   *
   * @param paths - 路径片段
   * @returns 解析后的绝对路径
   */
  resolve: (...paths: string[]) => string
  /**
   * 使用默认参数安装依赖
   *
   * @param options - 命令执行选项
   * @returns 安装完成后兑现的 Promise
   */
  install(options?: RunCommandOptions): Promise<void>
  /**
   * 使用指定命令行参数安装依赖
   *
   * @param args - 命令行参数
   * @param option - 命令执行选项
   * @returns 安装完成后兑现的 Promise
   */
  install(args: string[], option?: RunCommandOptions): Promise<void>
  // #endregion
}

/**
 * 旧版 `Api` 允许模板自行扩展的宽松字段集合
 *
 * @remarks
 * `any` 仅保留在废弃兼容层，新插件应改用 `CreatePluginContext` 并显式收窄未知字段
 *
 * @internal
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LegacyExtensionRecord = Record<string, any>

/**
 * 旧版 `Api` 使用的 Modify Hook 注册签名
 *
 * @typeParam Value - Hook 顺序传递的值
 * @typeParam Args - Hook 附加参数
 * @internal
 */
type LegacyModifyRegistration<Value, Args = void> = (
  fn: (memo: Value, args: Args) => MaybePromise<Value>,
  options?: HookRegistrationOptions,
) => void

/**
 * 旧版 `Api` 使用的 Event Hook 注册签名
 *
 * @typeParam Args - 事件参数
 * @internal
 */
type LegacyEventRegistration<Args> = (
  fn: (args: Args) => MaybePromise<void | undefined>,
  options?: HookRegistrationOptions,
) => void

/**
 * create 插件入口上下文的兼容名称
 *
 * @remarks
 * 保留旧版动态扩展字段的宽松读取能力以支持现有模板插件；宽松类型仅作用于
 * 应用数据、交互结果、TypeScript 配置及其相关 Hook，新代码应使用
 * {@link CreatePluginContext}
 *
 * @deprecated 使用 {@link CreatePluginContext}
 */
export type Api = Omit<
  CreatePluginContext,
  | 'appData'
  | 'modifyAppData'
  | 'modifyPrompts'
  | 'modifyTsConfig'
  | 'onBeforeGenerateFiles'
  | 'onGenerateFiles'
  | 'prompts'
  | 'tsConfig'
> & {
  readonly appData: AppData<LegacyExtensionRecord>
  readonly prompts: Prompts<LegacyExtensionRecord>
  readonly tsConfig: Readonly<LegacyExtensionRecord>
  modifyAppData: LegacyModifyRegistration<
    AppData<LegacyExtensionRecord>,
    { cwd: string }
  >
  modifyPrompts: LegacyModifyRegistration<
    Prompts<LegacyExtensionRecord>,
    { questions: prompts.PromptObject[] }
  >
  modifyTsConfig: LegacyModifyRegistration<LegacyExtensionRecord>
  onBeforeGenerateFiles: LegacyEventRegistration<{
    prompts: Prompts<LegacyExtensionRecord>
    paths: Paths
  }>
  onGenerateFiles: LegacyEventRegistration<{
    prompts: Prompts<LegacyExtensionRecord>
    paths: Paths
  }>
}
