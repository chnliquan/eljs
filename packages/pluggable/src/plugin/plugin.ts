import {
  camelCase,
  isPathExistsSync,
  loadTsSync,
  readJSONSync,
  resolve,
  winPath,
  type PkgJSON,
} from '@eljs/utils'
import assert from 'assert'
import hash from 'hash-sum'
import { basename, dirname, extname, join, relative } from 'path'
import { pkgUpSync } from 'pkg-up'

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
export class Plugin<
  C extends Record<string, unknown> = Record<string, unknown>,
> {
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
   * 插件配置项
   */
  public config: C = Object.create(null)
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
    ...args: unknown[]
  ) => PluginReturnType | Promise<PluginReturnType>
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

    let pkgJSON = {} as PkgJSON
    let isPkgEntry = false
    const pkgJSONPath = pkgUpSync({ cwd: this.path }) as string

    if (pkgJSONPath) {
      pkgJSON = readJSONSync(pkgJSONPath)
      isPkgEntry =
        winPath(join(dirname(pkgJSONPath), pkgJSON.main || 'index.js')) ===
        winPath(this.path)
    }

    this.id = this._getId(pkgJSON.name as string, pkgJSONPath, isPkgEntry)
    this.key = this._getKey(pkgJSON.name as string, isPkgEntry)
    this.apply = () => {
      const ret = loadTsSync(this.path)
      this.config = ret.config ?? Object.create(null)
      return ret.__esModule ? ret.default : ret
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
   * @param pkgJSONPath package.json 路径
   * @param isPkgEntry 是否是入口
   */
  private _getId(pkgName: string, pkgJSONPath: string, isPkgEntry: boolean) {
    let id = ''

    if (isPkgEntry) {
      id = pkgName
    } else if (winPath(this.path).startsWith(winPath(this._cwd))) {
      id = `./${winPath(relative(this._cwd, this.path))}`
    } else if (pkgJSONPath) {
      id = winPath(join(pkgName, relative(dirname(pkgJSONPath), this.path)))
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
   * @param presets 预设路径合集
   * @param plugins 插件路径合集
   */
  public static getPresetsAndPlugins(
    cwd: string,
    presets?: string[],
    plugins?: string[],
  ) {
    return {
      presets: get('preset'),
      plugins: get('plugin'),
    }

    function get(type: PluginType) {
      const presetsOrPlugins = type === 'preset' ? presets : plugins

      if (presetsOrPlugins?.length) {
        return presetsOrPlugins.map(path => {
          assert(
            typeof path === 'string',
            `Invalid plugin ${path}, it must be string.`,
          )

          let resolvedPath = ''

          try {
            resolvedPath = resolve.sync(path, {
              basedir: cwd,
              extensions: ['.tsx', '.ts', '.mjs', '.jsx', '.js'],
            })
          } catch (_) {
            throw new Error(`Invalid plugin ${path}, can not be resolved.`)
          }

          return new Plugin({
            path: resolvedPath,
            type,
            cwd,
          })
        })
      }
    }
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
