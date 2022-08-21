import { camelCase, PkgJson, register, resolve, winPath } from '@eljs/utils'
import assert from 'assert'
import esbuild from 'esbuild'
import { existsSync } from 'fs'
import sum from 'hash-sum'
import { basename, dirname, extname, join, relative } from 'path'
import { pkgUpSync } from 'pkg-up'
import { EnableBy, PluginReturnType } from '../types'

const RE = {
  preset: /^(@eljs\/|eljs-)create-preset-/,
  plugin: /^(@eljs\/|eljs-)create-plugin-/,
}

type PluginType = 'plugin' | 'preset'

export interface PluginOpts {
  path: Plugin['path']
  cwd: Plugin['_cwd']
  type: Plugin['type']
}

export class Plugin {
  private _cwd: string

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
   * 插件 Key
   */
  public key: string
  /**
   * 插件执行函数
   */
  public apply: () => (
    ...args: any[]
  ) => PluginReturnType | Promise<PluginReturnType>
  /**
   * 插件是否可以执行
   */
  public enableBy: EnableBy | (() => boolean) = EnableBy.register

  public constructor(opts: PluginOpts) {
    this.type = opts.type
    this.path = winPath(opts.path)
    this._cwd = opts.cwd

    assert(
      existsSync(this.path),
      `Invalid ${this.type} ${this.path}, it's not exists.`,
    )

    let pkg = null
    let isPkgEntry = false
    const pkgJSONPath = pkgUpSync({ cwd: this.path }) as string

    if (pkgJSONPath) {
      pkg = require(pkgJSONPath)
      isPkgEntry =
        winPath(join(dirname(pkgJSONPath), pkg.main || 'index.js')) ===
        winPath(this.path)
    }

    this.id = this.getId({ pkg, isPkgEntry, pkgJSONPath })
    this.key = this.getKey({ pkg, isPkgEntry })
    this.apply = () => {
      register.register({
        implementor: esbuild,
        exts: ['.ts'],
      })
      register.clearFiles()
      let ret
      try {
        ret = require(this.path)
      } catch (e: any) {
        throw new Error(
          `Register ${this.type} ${this.path} failed, since ${e.message}`,
        )
      } finally {
        register.restore()
      }
      // use the default member for es modules
      return ret.__esModule ? ret.default : ret
    }
  }

  public merge(opts: { key?: string; enableBy?: any }) {
    if (opts.key) {
      this.key = opts.key
    }

    if (opts.enableBy) {
      this.enableBy = opts.enableBy
    }
  }

  public getId(opts: {
    pkg: PkgJson
    isPkgEntry: boolean
    pkgJSONPath: string | null
  }) {
    let id = ''

    if (opts.isPkgEntry) {
      id = opts.pkg.name as string
    } else if (winPath(this.path).startsWith(winPath(this._cwd))) {
      id = `./${winPath(relative(this._cwd, this.path))}`
    } else if (opts.pkgJSONPath) {
      id = winPath(
        join(
          opts.pkg.name as string,
          relative(dirname(opts.pkgJSONPath), this.path),
        ),
      )
    } else {
      id = winPath(this.path)
    }

    id = id.replace('@eljs/generator/lib/core', '@@')
    id = id.replace(/\.js$/, '')
    return id
  }

  public getKey(opts: { pkg: PkgJson; isPkgEntry: boolean }) {
    // e.g.
    // initial-state -> initialState
    // webpack.css-loader -> webpack.cssLoader
    function nameToKey(name: string) {
      return name
        .split('.')
        .map(part => camelCase(part))
        .join('.')
    }

    if (opts.isPkgEntry) {
      return nameToKey(
        Plugin.stripNoneUmiScope(opts.pkg.name as string).replace(
          RE[this.type],
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

  public static isPresetOrPlugin(type: PluginType, name: string) {
    return RE[type].test(Plugin.stripNoneUmiScope(name))
  }

  public static stripNoneUmiScope(name: string) {
    if (name.charAt(0) === '@' && !name.startsWith('@eljs/')) {
      name = name.split('/')[1]
    }
    return name
  }

  public static getPluginsAndPresets(opts: {
    cwd: string
    plugins?: string[]
    presets?: string[]
  }) {
    function get(type: PluginType) {
      const types = `${type}s` as 'plugins' | 'presets'
      return [
        // opts
        ...(opts[types] || []),
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
      presets: get('preset'),
      plugins: get('plugin'),
    }
  }
}
