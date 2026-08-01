import { isPathExistsSync, readJsonSync } from '@eljs/utils/file'
import { findUp } from '@eljs/utils/module'
import { winPath } from '@eljs/utils/path'
import { camelCase } from '@eljs/utils/string'
import type { PackageJson } from '@eljs/utils/types'
import { createHash } from 'node:crypto'
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
} from 'node:path'

import { PluginHostError, PluginHostErrorCode } from '../errors'
import { SUPPORTED_PLUGIN_EXTENSIONS } from './plugin-formats'
import { loadPluginInitializer } from './plugin-loader'
import type {
  PluginDiagnostics,
  PluginExecutionMetrics,
  PluginHookEnablement,
  PluginInitializer,
  PluginMetadata,
  PluginOptions,
  PluginType,
} from './types'

/**
 * 表示一个已经解析的 preset 或 plugin
 */
export class Plugin {
  /**
   * 构造函数选项
   */
  public readonly constructorOptions: Readonly<PluginOptions>
  /**
   * 插件类型
   */
  public readonly type: PluginType
  /**
   * 插件入口路径
   */
  public readonly path: string
  /**
   * 插件 ID
   */
  public readonly id: string
  /**
   * 插件 key 的内部可变值
   */
  private _key: string
  /**
   * 插件执行诊断的内部可变值
   */
  private readonly _metrics: PluginExecutionMetrics = {
    hookDurationsMs: Object.create(null),
    hookErrorCounts: Object.create(null),
  }
  /**
   * 插件 Hook 启用条件的内部可变值
   */
  private _enable: PluginHookEnablement = true
  /**
   * 当前工作目录
   */
  private readonly _cwd: string

  /**
   * 插件 key
   *
   * @returns 当前公开 key
   */
  public get key(): string {
    return this._key
  }

  /**
   * 插件 Hook 启用条件
   *
   * @returns 静态开关或动态判断函数
   */
  public get enable(): PluginHookEnablement {
    return this._enable
  }

  /**
   * 创建插件元数据及延迟入口加载器
   *
   * @param options - 插件入口、类型和工作目录
   * @throws {@link PluginHostError}
   * 当入口不存在或扩展名不受支持时抛出
   */
  public constructor(options: PluginOptions) {
    if (
      !options ||
      typeof options.cwd !== 'string' ||
      !options.cwd.trim() ||
      typeof options.path !== 'string' ||
      !options.path.trim() ||
      (options.type !== 'plugin' && options.type !== 'preset')
    ) {
      throw new PluginHostError(
        PluginHostErrorCode.InvalidOptions,
        `Invalid Plugin constructor options.`,
        { details: { options } },
      )
    }

    const cwd = resolve(options.cwd)
    this.path = winPath(resolve(cwd, options.path))
    this.type = options.type
    this._cwd = winPath(cwd)
    this.constructorOptions = Object.freeze({
      ...options,
      cwd: this._cwd,
      path: this.path,
    })

    if (!isPathExistsSync(this.path)) {
      throw new PluginHostError(
        PluginHostErrorCode.InvalidPluginPath,
        `Invalid \`${this.type}\` in ${this.path}, could not be found.`,
        { details: { path: this.path, pluginType: this.type } },
      )
    }

    const extension = extname(this.path)
    if (
      !SUPPORTED_PLUGIN_EXTENSIONS.includes(
        extension as (typeof SUPPORTED_PLUGIN_EXTENSIONS)[number],
      )
    ) {
      throw new PluginHostError(
        PluginHostErrorCode.UnsupportedPluginExtension,
        `Unsupported ${this.type} extension \`${extension || '(none)'}\` in ${
          this.path
        }. Supported extensions: ${SUPPORTED_PLUGIN_EXTENSIONS.join(', ')}.`,
      )
    }

    let pkg = {} as PackageJson
    let isPkgEntry = false
    const pkgJsonPath = findUp.sync('package.json', {
      cwd: dirname(this.path),
    }) as string

    if (pkgJsonPath) {
      pkg = readJsonSync(pkgJsonPath)
      isPkgEntry =
        typeof pkg.name === 'string' &&
        winPath(join(dirname(pkgJsonPath), pkg.main || 'index.js')) ===
          winPath(this.path)
    }

    this.id = this._getId(pkg.name as string, pkgJsonPath, isPkgEntry)
    this._key = this._getKey(pkg.name as string, isPkgEntry)
  }

  /**
   * 更新插件描述信息
   *
   * @param options - 可选的插件 key 和 Hook 启用条件
   *
   * @internal
   */
  public configure(options: {
    key?: string
    enable?: PluginHookEnablement
  }): void {
    if (!options || typeof options !== 'object') {
      throw new PluginHostError(
        PluginHostErrorCode.InvalidOptions,
        `Invalid plugin description.`,
        { details: { options, pluginId: this.id } },
      )
    }

    const { key, enable } = options

    if (
      (key !== undefined &&
        (typeof key !== 'string' || !key.trim() || key !== key.trim())) ||
      (enable !== undefined &&
        typeof enable !== 'boolean' &&
        typeof enable !== 'function')
    ) {
      throw new PluginHostError(
        PluginHostErrorCode.InvalidOptions,
        `Invalid plugin description.`,
        {
          details: {
            enableType: typeof enable,
            key,
            pluginId: this.id,
          },
        },
      )
    }

    if (key !== undefined) {
      this._key = key
    }

    if (enable !== undefined) {
      this._enable = enable
    }
  }

  /**
   * 加载插件入口函数
   *
   * @returns 插件初始化函数
   * @throws {@link PluginHostError}
   * 当模块无法加载或没有导出初始化函数时抛出
   */
  public async loadInitializer(): Promise<PluginInitializer<unknown>> {
    return loadPluginInitializer(this.path, this.type)
  }

  /**
   * 记录插件初始化耗时和结果
   *
   * @param durationMs - 初始化耗时，单位为毫秒
   * @param failed - 初始化是否失败
   *
   * @internal
   */
  public recordInitialization(durationMs: number, failed: boolean): void {
    this._metrics.initializationDurationMs = durationMs
    this._metrics.initializationFailed = failed || undefined
  }

  /**
   * 记录一次 Hook 执行结果
   *
   * @param key - Hook key
   * @param durationMs - 执行耗时，单位为毫秒
   * @param failed - 执行是否失败
   * @param sampleLimit - 保留的最近耗时样本数量
   *
   * @internal
   */
  public recordHookExecution(
    key: string,
    durationMs: number,
    failed: boolean,
    sampleLimit: number,
  ): void {
    const samples = (this._metrics.hookDurationsMs[key] ||= [])
    samples.push(durationMs)

    if (samples.length > sampleLimit) {
      samples.splice(0, samples.length - sampleLimit)
    }

    if (failed) {
      this._metrics.hookErrorCounts[key] =
        (this._metrics.hookErrorCounts[key] || 0) + 1
    }
  }

  /**
   * 创建只读插件元数据快照
   *
   * @returns 与插件内部状态隔离的元数据
   */
  public getMetadata(): PluginMetadata {
    return Object.freeze({
      id: this.id,
      key: this.key,
      path: this.path,
      type: this.type,
    })
  }

  /**
   * 创建插件调试信息快照
   *
   * @returns 与内部可变数据隔离的诊断信息
   */
  public getDiagnostics(): PluginDiagnostics {
    return {
      ...this.getMetadata(),
      metrics: {
        initializationDurationMs: this._metrics.initializationDurationMs,
        initializationFailed: this._metrics.initializationFailed,
        hookDurationsMs: Object.fromEntries(
          Object.entries(this._metrics.hookDurationsMs).map(
            ([key, samples]) => [key, [...samples]],
          ),
        ),
        hookErrorCounts: { ...this._metrics.hookErrorCounts },
      },
    }
  }

  /**
   * 生成用于识别重复声明的插件 ID
   *
   * @param pkgName - NPM 包名
   * @param pkgPath - `package.json` 路径
   * @param isPkgEntry - 当前文件是否为包入口
   * @returns 插件 ID
   */
  private _getId(pkgName: string, pkgPath: string, isPkgEntry: boolean) {
    let id: string

    if (isPkgEntry) {
      id = pkgName
    } else {
      const relativePath = winPath(relative(this._cwd, this.path))
      const isInsideCwd =
        relativePath !== '' &&
        relativePath !== '..' &&
        !relativePath.startsWith('../') &&
        !isAbsolute(relativePath)

      if (isInsideCwd) {
        id = `./${relativePath}`
      } else if (pkgPath && pkgName) {
        id = winPath(join(pkgName, relative(dirname(pkgPath), this.path)))
      } else {
        id = winPath(this.path)
      }
    }

    const extension = extname(id)
    if (
      SUPPORTED_PLUGIN_EXTENSIONS.includes(
        extension as (typeof SUPPORTED_PLUGIN_EXTENSIONS)[number],
      )
    ) {
      id = id.slice(0, -extension.length)
    }
    return id
  }

  /**
   * 生成插件 API 使用的默认 key
   *
   * @param pkgName - NPM 包名
   * @param isPkgEntry - 当前文件是否为包入口
   * @returns 规范化后的插件 key
   */
  private _getKey(pkgName: string, isPkgEntry: boolean): string {
    if (isPkgEntry) {
      return name2Key(Plugin.stripNonEljsScope(pkgName))
    }

    const key = basename(this.path, extname(this.path))

    if (key === 'index') {
      const pathHash = createHash('sha256')
        .update(this.path)
        .digest('hex')
        .slice(0, 8)
      return `${pathHash}_${key}`
    }

    return name2Key(key)

    // initial-state -> initialState
    // webpack.css-loader -> webpack.cssLoader
    function name2Key(name: string) {
      return name
        .split('.')
        .map(part => camelCase(part))
        .join('.')
    }
  }

  /**
   * 去除非 `\@eljs` 作用域前缀
   *
   * @param name - NPM 包名
   * @returns 用于生成插件 key 的包名
   */
  public static stripNonEljsScope(name: string): string {
    if (name.charAt(0) === '@' && !name.startsWith('@eljs/')) {
      name = name.split('/')[1] || name
    }
    return name
  }
}
