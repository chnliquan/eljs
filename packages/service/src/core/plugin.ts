import {
  camelCase,
  isPathExistsSync,
  loadTsSync,
  resolve,
  winPath,
  type PkgJSON,
} from '@eljs/utils'
import assert from 'assert'
import sum from 'hash-sum'
import { basename, dirname, extname, join, relative } from 'path'
import pkgUp from 'pkg-up'
import { EnableBy } from '../enum'
import type {
  PluginConfig,
  PluginReturnType,
  PluginType,
  PresetsOrPluginsExtractor,
  UserConfig,
} from '../types'

export interface PluginOpts {
  path: Plugin['path']
  type: Plugin['type']
  cwd: Plugin['_cwd']
  prefix?: Plugin['_prefix']
}

export class Plugin {
  /**
   * 插件类型
   */
  public type: PluginType
  /**
   * 预设/插件入口
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
  public config: PluginConfig = Object.create(null)
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
  public enableBy: EnableBy | (() => boolean) = EnableBy.Register
  /**
   * 当前路径
   */
  private _cwd: string
  /**
   * 当前路径
   */
  private _prefix: string
  /**
   * 插件唯一 key 正则映射表
   */
  private _key2RegexMap!: {
    preset: RegExp
    plugin: RegExp
  }

  public constructor(opts: PluginOpts) {
    this.type = opts.type
    this.path = winPath(opts.path)
    this._cwd = opts.cwd
    this._prefix = opts.prefix || '@eljs/service-'

    assert(
      isPathExistsSync(this.path),
      `Invalid ${this.type} ${this.path}, it's not exists.`,
    )

    let pkgJSON = null as unknown as PkgJSON
    let isPkgEntry = false
    const pkgJSONPath = pkgUp.sync({ cwd: this.path }) as string

    if (pkgJSONPath) {
      pkgJSON = require(pkgJSONPath)
      isPkgEntry =
        winPath(join(dirname(pkgJSONPath), pkgJSON.main || 'index.js')) ===
        winPath(this.path)
    }

    this.id = this.getId({ pkgJSON, isPkgEntry, pkgJSONPath })
    this.key = this.getKey({ pkgJSON, isPkgEntry })
    this.apply = () => {
      const ret = loadTsSync(this.path)
      this.config = ret.config ?? Object.create(null)
      // use the default member for es modules
      return ret.__esModule ? ret.default : ret
    }
  }

  public get key2RegexMap() {
    if (!this._key2RegexMap) {
      this._key2RegexMap = {
        preset: new RegExp(`^${this._prefix}preset-`),
        plugin: new RegExp(`^${this._prefix}plugin-`),
      }
    }

    return this._key2RegexMap
  }

  public merge(opts: { key?: string; enableBy?: unknown }) {
    if (opts.key) {
      this.key = opts.key
    }

    if (opts.enableBy) {
      this.enableBy = opts.enableBy as Plugin['enableBy']
    }
  }

  public getId(opts: {
    pkgJSON: PkgJSON
    isPkgEntry: boolean
    pkgJSONPath: string | null
  }) {
    const { pkgJSON, isPkgEntry, pkgJSONPath } = opts
    let id = ''

    if (isPkgEntry) {
      id = pkgJSON.name as string
    } else if (winPath(this.path).startsWith(winPath(this._cwd))) {
      id = `./${winPath(relative(this._cwd, this.path))}`
    } else if (pkgJSONPath) {
      id = winPath(
        join(pkgJSON.name as string, relative(dirname(pkgJSONPath), this.path)),
      )
    } else {
      id = winPath(this.path)
    }

    id = id.replace('@eljs/lib/core', '@@')
    id = id.replace(/\.js$/, '')
    return id
  }

  public getKey(opts: { pkgJSON: PkgJSON; isPkgEntry: boolean }) {
    const { pkgJSON, isPkgEntry } = opts
    // e.g.
    // initial-state -> initialState
    // webpack.css-loader -> webpack.cssLoader
    function nameToKey(name: string) {
      return name
        .split('.')
        .map(part => camelCase(part))
        .join('.')
    }

    if (isPkgEntry) {
      return nameToKey(
        Plugin.stripNoneScope(pkgJSON.name as string).replace(
          this.key2RegexMap[this.type],
          '',
        ),
      )
    }

    const key = basename(this.path, extname(this.path))

    if (key === 'index') {
      return `${sum(this.path)}_${key}`
    }

    return nameToKey(key)
  }

  public static stripNoneScope(name: string) {
    if (name.charAt(0) === '@' && !name.startsWith('@eljs/')) {
      name = name.split('/')[1]
    }
    return name
  }

  public static getPresetsAndPlugins(opts: {
    cwd: string
    userConfig: UserConfig
    plugins?: string[]
    presets?: string[]
    presetsExtractor?: PresetsOrPluginsExtractor
    pluginsExtractor?: PresetsOrPluginsExtractor
  }) {
    function get(type: PluginType) {
      const types = `${type}s` as 'presets' | 'plugins'
      const presetsOrPlugins = opts[types] || []
      const extractor =
        type === 'preset' ? opts.presetsExtractor : opts.pluginsExtractor

      return [
        ...presetsOrPlugins,
        ...(opts.userConfig[types] || []),
        ...(extractor?.(presetsOrPlugins, opts.cwd, opts) || []),
      ].map(path => {
        assert(
          typeof path === 'string',
          `Invalid plugin ${path}, it must be string.`,
        )

        let resolved

        try {
          resolved = resolve.sync(path, {
            basedir: opts.cwd,
            extensions: ['.tsx', '.ts', '.mjs', '.jsx', '.js'],
          })
        } catch (_) {
          throw new Error(`Invalid plugin ${path}, can not be resolved.`)
        }

        return new Plugin({
          path: resolved,
          type,
          cwd: opts.cwd,
        })
      })
    }

    return {
      presets: get('preset' as PluginType),
      plugins: get('plugin' as PluginType),
    }
  }
}
