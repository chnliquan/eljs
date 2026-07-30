import {
  camelCase,
  fileLoadersSync,
  findUp,
  isPathExistsSync,
  readJsonSync,
  resolve,
  winPath,
  type PackageJson,
} from '@eljs/utils'
import assert from 'node:assert'
import { createHash } from 'node:crypto'
import { basename, dirname, extname, join, relative } from 'node:path'

import { PluggableError, PluggableErrorCode } from '../errors'
import type { PluginDeclaration, ResolvedPlugin } from '../pluggable'
import type {
  Enable,
  PluginApply,
  PluginOptions,
  PluginTime,
  PluginType,
} from './types'

/**
 * 支持的插件入口扩展名
 */
export const SUPPORTED_PLUGIN_EXTENSIONS = ['.js', '.cjs', '.ts'] as const

/**
 * 插件类
 */
export class Plugin {
  /**
   * 构造函数选项
   */
  public constructorOptions: PluginOptions
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
  public time: PluginTime = {
    hooks: Object.create(null),
    hookErrors: Object.create(null),
  }
  /**
   * 插件执行函数
   */
  public apply: () => PluginApply
  /**
   * 插件是否可以执行
   */
  public enable: Enable = true
  /**
   * 当前工作目录
   */
  private _cwd: string

  public constructor(options: PluginOptions) {
    this.constructorOptions = options
    this.path = winPath(options.path)
    this.type = options.type
    this._cwd = options.cwd

    assert(
      isPathExistsSync(this.path),
      `Invalid \`${this.type}\` in ${this.path}, could not be found.`,
    )

    const extension = extname(this.path)
    if (
      !SUPPORTED_PLUGIN_EXTENSIONS.includes(
        extension as (typeof SUPPORTED_PLUGIN_EXTENSIONS)[number],
      )
    ) {
      throw new PluggableError(
        PluggableErrorCode.UnsupportedPluginExtension,
        `Unsupported ${this.type} extension \`${extension || '(none)'}\` in ${
          this.path
        }. Supported extensions: ${SUPPORTED_PLUGIN_EXTENSIONS.join(', ')}.`,
      )
    }

    let pkg = {} as PackageJson
    let isPkgEntry = false
    const pkgJsonPath = findUp.sync('package.json', {
      cwd: this.path,
    }) as string

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
        if (!loader) {
          throw new PluggableError(
            PluggableErrorCode.UnsupportedPluginExtension,
            `No loader is available for ${this.type} ${this.path}.`,
          )
        }

        const content = loader(this.path) as {
          default: ReturnType<typeof Plugin.prototype.apply>
        }
        const apply = content?.default ?? content

        if (!(typeof apply === 'function')) {
          throw new Error(
            `Load \`${this.type}\` failed in ${this.path}, expected function, but got \`${apply}\`.`,
          )
        }

        return apply
      } catch (error) {
        const err = error as Error
        err.message = err.message.replace(
          /Load (\/.*?) failed:/,
          `Load \`${this.type}\` failed in ${this.path}:`,
        )
        throw err
      }
    }
  }

  /**
   * 合并选项
   * @param options.key 插件唯一 key
   * @param options.enable 插件是否开启
   */
  public merge(options: { key?: string; enable?: Enable }) {
    const { key, enable } = options

    if (key) {
      this.key = key
    }

    if (enable !== undefined) {
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
    let id: string

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
      if (!presetsOrPlugins?.length) {
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
    return plugins
      .map(plugin => {
        const [pluginName, pluginOptions] =
          typeof plugin === 'string' ? [plugin, undefined] : plugin

        let resolvedPath: string

        if (!pluginName) {
          return
        }

        try {
          resolvedPath = resolve.sync(pluginName, {
            basedir: cwd,
            extensions: [...SUPPORTED_PLUGIN_EXTENSIONS].reverse(),
          })
        } catch (error) {
          throw new PluggableError(
            PluggableErrorCode.PluginResolveFailed,
            `Invalid plugin \`${pluginName}\`, can not be resolved.`,
            { cause: error },
          )
        }

        return [
          new Plugin({
            path: resolvedPath,
            type,
            cwd,
          }),
          pluginOptions,
        ]
      })
      .filter(Boolean) as ResolvedPlugin[]
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
