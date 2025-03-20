import type { PluginDeclaration, ResolvedPlugin } from '@/pluggable'
import {
  camelCase,
  fileLoadersSync,
  isESModule,
  isPathExistsSync,
  readJsonSync,
  resolve,
  winPath,
  type MaybePromise,
  type PackageJson,
} from '@eljs/utils'
import hash from 'hash-sum'
import assert from 'node:assert'
import { basename, dirname, extname, join, relative } from 'node:path'
import pkgUp from 'pkg-up'

import type { Enable, PluginReturnType, PluginType } from './types'

/**
 * 插件参数
 */
export interface PluginOptions {
  /**
   * 插件类型
   */
  type: PluginType
  /**
   * 插件入口路径
   */
  path: string
  /**
   * 当前工作目录
   */
  cwd: string
}

/**
 * 插件类
 */
export class Plugin {
  /**
   * 插件参数
   */
  public options: PluginOptions
  /**
   * 插件类型
   */
  public type: PluginType
  /**
   * 插件入口路径
   */
  public path: string
  /**
   * 插件 ID
   */
  public id: string
  /**
   * 插件 key
   */
  public key: string
  /**
   * 插件执行时间
   */
  public time: {
    register?: number
    hooks: Record<string, number[]>
  } = { hooks: {} }
  /**
   * 插件执行函数
   */
  public apply: () => (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...args: any[]
  ) => MaybePromise<PluginReturnType>
  /**
   * 插件是否可以执行
   */
  public enable!: Enable
  /**
   * 当前工作目录
   */
  private _cwd: string

  public constructor(options: PluginOptions) {
    this.options = options
    this.path = winPath(options.path)
    this.type = options.type
    this._cwd = options.cwd

    assert(
      isPathExistsSync(this.path),
      `Invalid ${this.type} ${this.path}, it's not exists.`,
    )

    let pkg = {} as PackageJson
    let isPkgEntry = false
    const pkgJsonPath = pkgUp.sync({ cwd: this.path }) as string

    if (pkgJsonPath) {
      pkg = readJsonSync(pkgJsonPath)
      isPkgEntry =
        winPath(join(dirname(pkgJsonPath), pkg.main || 'index.js')) ===
        winPath(this.path)
    }

    this.id = this._getId(pkg.name as string, pkgJsonPath, isPkgEntry)
    this.key = this._getKey(pkg.name as string, isPkgEntry)
    this.apply = () => {
      const loader =
        fileLoadersSync[extname(this.path) as keyof typeof fileLoadersSync]

      try {
        const content = loader(this.path) as ReturnType<
          typeof Plugin.prototype.apply
        >
        return isESModule<ReturnType<typeof Plugin.prototype.apply>>(content)
          ? content.default
          : content
      } catch (error) {
        const err = error as Error
        err.message = `Load ${this.type} failed in ${this.path}:\n${err.message}`
        throw err
      }
    }
  }

  /**
   * 合并配置项
   * @param options.key 插件唯一 key
   * @param options.enable 插件是否开启
   */
  public merge(options: { key?: string; enable?: Enable }) {
    const { key, enable } = options

    if (key) {
      this.key = key
    }

    if (enable) {
      this.enable = enable
    }
  }

  /**
   * 获取插件 ID
   * @param pkgName NPM 包名
   * @param pkgPath package.json 路径
   * @param isPkgEntry 是否是入口
   */
  private _getId(pkgName: string, pkgPath: string, isPkgEntry: boolean) {
    let id = ''

    if (isPkgEntry) {
      id = pkgName
    } else if (winPath(this.path).startsWith(winPath(this._cwd))) {
      id = `./${winPath(relative(this._cwd, this.path))}`
    } else if (pkgPath) {
      id = winPath(join(pkgName, relative(dirname(pkgPath), this.path)))
    } else {
      id = winPath(this.path)
    }

    id = id.replace(/\.js$/, '')
    return id
  }

  private _getKey(pkgName: string, isPkgEntry: boolean): string {
    if (isPkgEntry) {
      return name2Key(Plugin.stripNoneScope(pkgName))
    }

    const key = basename(this.path, extname(this.path))

    if (key === 'index') {
      return `${hash(this.path)}_${key}`
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
   * 获取预设和插件
   * @param cwd 当前工作目录
   * @param presets 预设定义集合
   * @param plugins 插件定义集合
   */
  public static getPresetsAndPlugins(
    cwd: string,
    presets?: PluginDeclaration[],
    plugins?: PluginDeclaration[],
  ) {
    return {
      presets: get('preset') as ResolvedPlugin[],
      plugins: get('plugin') as ResolvedPlugin[],
    }

    function get(type: PluginType) {
      const presetsOrPlugins = type === 'preset' ? presets : plugins
      if (!presetsOrPlugins) {
        return
      }
      return Plugin.resolvePlugins(presetsOrPlugins, type, cwd)
    }
  }

  /**
   * 解析插件
   * @param plugins 待解析插件集合
   * @param type 插件类型
   * @param cwd 当前工作目录
   */
  public static resolvePlugins(
    plugins: PluginDeclaration[],
    type: PluginType,
    cwd: string,
  ): ResolvedPlugin[] {
    return plugins.map(plugin => {
      const [pluginName, pluginOptions] =
        typeof plugin === 'string' ? [plugin, null] : plugin

      let resolvedPath = ''

      try {
        resolvedPath = resolve.sync(pluginName, {
          basedir: cwd,
          extensions: ['.tsx', '.ts', '.mjs', '.jsx', '.js'],
        })
      } catch (_) {
        throw new Error(`Invalid plugin ${pluginName}, can not be resolved.`)
      }

      return [
        new Plugin({
          path: resolvedPath,
          type,
          cwd,
        }),
        pluginOptions,
      ] as ResolvedPlugin
    })
  }

  /**
   * 去除 NPM 包的前缀
   * @param name NPM 包名
   */
  public static stripNoneScope(name: string): string {
    if (name.charAt(0) === '@' && !name.startsWith('@eljs/')) {
      name = name.split('/')[1]
    }
    return name
  }
}
