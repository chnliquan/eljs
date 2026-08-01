import type { PluginContext } from '@eljs/plugin-host'
import type {
  CopyFileOptions,
  PackageJson,
  RenderTemplateOptions,
  RunCommandOptions,
} from '@eljs/utils'

import { createHookSchema, type CreatePluginCapabilities } from '../hooks'

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
   * @param options - 拷贝选项
   * @returns 拷贝完成后兑现的 Promise
   */
  copyFile: (
    from: string,
    to: string,
    options: CopyFileOptions,
  ) => Promise<void>
  /**
   * 拷贝模板文件
   *
   * @param from - 源文件路径
   * @param to - 目标文件路径
   * @param data - 模板数据
   * @param options - 拷贝选项
   * @returns 拷贝完成后兑现的 Promise
   */
  copyTpl: (
    from: string,
    to: string,
    data: object,
    options: CopyFileOptions,
  ) => Promise<void>
  /**
   * 递归拷贝模板目录
   *
   * @param from - 源目录路径
   * @param to - 目标目录路径
   * @param data - 模板数据
   * @param options - 拷贝选项
   * @returns 拷贝完成后兑现的 Promise
   */
  copyDirectory: (
    from: string,
    to: string,
    data: object,
    options: CopyFileOptions,
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
   *
   * @param partial - 待合并的 `package.json` 字段
   */
  extendPackage(partial: PackageJson): void
  /**
   * 使用转换函数扩展 `package.json`
   *
   * @remarks
   * 转换函数会在交互输入和应用数据就绪后执行，因此可以读取 `context.prompts` 与 `context.appData`
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
