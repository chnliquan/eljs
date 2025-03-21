import { Runner, type RunnerPluginApi } from '@/core'
import type { PluggablePluginApi, PluginApi } from '@eljs/pluggable'
import type {
  CopyFileOptions,
  PackageJson,
  RenderTemplateOptions,
} from '@eljs/utils'

/**
 * 插件 api 参数
 */
export type Api = PluginApi<Runner> &
  PluggablePluginApi &
  RunnerPluginApi & {
    // #region 插件工具方法
    /**
     * 拷贝文件
     * @param from 源文件路径
     * @param to 目标文件路径
     * @param options 可选配置项
     */
    copyFile: (
      from: string,
      to: string,
      options: CopyFileOptions,
    ) => Promise<void>
    /**
     * 拷贝模版
     * @param from 源文件路径
     * @param to 目标文件路径
     * @param data 模版数据
     * @param options 可选配置项
     */
    copyTpl: (
      from: string,
      to: string,
      data: object,
      options: CopyFileOptions,
    ) => Promise<void>
    /**
     * 拷贝文件夹
     * @param from 源文件路径
     * @param to 目标文件路径
     * @param data 模版数据
     * @param options 可选配置项
     */
    copyDirectory: (
      from: string,
      to: string,
      data: object,
      options: CopyFileOptions,
    ) => Promise<void>
    /**
     * 渲染模版
     * @param path 模版路径
     * @param data 模版数据
     * @param options 可选配置项
     */
    render: (
      path: string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: Record<string, any>,
      options?: RenderTemplateOptions,
    ) => Promise<void>
    /**
     * 扩展 package.json
     * @param partialPkgJson 部分 packageJson 数据
     */
    extendPackage(partialPkgJson: PackageJson): void
    /**
     * 扩展 package.json
     * @param fn packageJson 获取函数
     */
    extendPackage(fn: (memo: PackageJson) => PackageJson): void
    /**
     * 在当前工程下解析一个路径
     * @param paths 文件路径
     */
    resolve: (...paths: string[]) => string
    /**
     * 安装依赖
     * @param args 命令行参数
     */
    install(args: string[]): Promise<void>
    // #endregion
  }
