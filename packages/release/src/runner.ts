import { type AppData, type Config } from '@/types'
import {
  Pluggable,
  type ApplyEvent,
  type ApplyGet,
  type ApplyModify,
  type PluggablePluginApi,
} from '@eljs/pluggable'
import {
  chalk,
  deepMerge,
  isPathExistsSync,
  logger,
  readJsonSync,
  type PackageJson,
  type RequiredRecursive,
} from '@eljs/utils'
import path from 'node:path'
import type { ReleaseType } from 'semver'

import { defaultConfig } from './default'
import { parseVersion } from './utils'

/**
 * 运行器类
 */
export class Runner extends Pluggable<Config> {
  /**
   * 配置项
   */
  public config!: RequiredRecursive<Config>
  /**
   * 应用数据
   */
  public appData: AppData = Object.create(null)

  public constructor(options: Config = {}) {
    const { cwd = process.cwd(), presets = [], plugins = [] } = options
    const projectPkgJsonPath = path.join(cwd, 'package.json')

    if (!isPathExistsSync(projectPkgJsonPath)) {
      logger.printErrorAndExit(
        `Detect ${chalk.bold.cyanBright(cwd)} has no package.json.`,
      )
    }

    const projectPkg = readJsonSync<PackageJson>(projectPkgJsonPath)

    if (!projectPkg.version) {
      logger.printErrorAndExit(
        `Detect ${chalk.bold.cyanBright(projectPkgJsonPath)} has no version field.`,
      )
    }
    super({
      ...options,
      cwd,
      defaultConfigFiles: ['release.config.ts', 'release.config.js'],
      presets: [require.resolve('./internal'), ...presets],
      plugins,
    })

    this.appData = {
      projectPkgJsonPath,
      projectPkg,
    } as AppData
  }

  public async run(releaseTypeOrVersion?: ReleaseType | string): Promise<void> {
    await this.load()

    this.config = await this.applyPlugins('modifyConfig', {
      initialValue: deepMerge(
        defaultConfig as RequiredRecursive<Config>,
        deepMerge(this.constructorOptions || {}, this.userConfig || {}),
      ),
    })

    /**
     * 修改应用数据
     */
    this.appData = await this.applyPlugins('modifyAppData', {
      initialValue: {
        ...this.appData,
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        cliVersion: require('../package.json').version,
        packageManager: 'pnpm',
      } as AppData,
      args: {
        cwd: this.cwd,
      },
    })

    /**
     * 应用检查
     */
    await this.applyPlugins('onCheck', {
      args: {
        releaseTypeOrVersion,
      },
    })
    /**
     * 应用启动
     */
    await this.applyPlugins('onStart')
    /**
     * 获取升级版本
     */
    const rawVersion = (await this.applyPlugins('getIncrementVersion', {
      args: {
        releaseTypeOrVersion,
      },
    })) as string

    if (rawVersion) {
      const version = parseVersion(rawVersion)

      await this.applyPlugins('onBeforeBumpVersion', {
        args: {
          ...version,
        },
      })

      await this.applyPlugins('onBumpVersion', {
        args: {
          ...version,
        },
      })

      await this.applyPlugins('onAfterBumpVersion', {
        args: {
          ...version,
        },
      })

      const changelog = (await this.applyPlugins('getChangelog', {
        args: {
          ...version,
        },
      })) as string

      await this.applyPlugins('onBeforeRelease', {
        args: {
          ...version,
          changelog,
        },
      })

      await this.applyPlugins('onRelease', {
        args: {
          ...version,
          changelog,
        },
      })

      await this.applyPlugins('onAfterRelease', {
        args: {
          ...version,
          changelog,
        },
      })
    }
  }

  public step(msg: string): void {
    return logger.step('Release', `${msg}\n`)
  }
}

/**
 * 运行器插件 API
 */
export interface RunnerPluginApi extends PluggablePluginApi {
  // #region 插件属性
  /**
   * 应用配置项，可通过 `modifyConfig` 方法修改
   */
  config: typeof Runner.prototype.config
  /**
   * 应用数据，可通过 `modifyAppData` 方法修改
   */
  appData: typeof Runner.prototype.appData
  // #endregion

  // #region 插件钩子
  /**
   * 修改应用数据
   */
  modifyConfig: ApplyModify<typeof Runner.prototype.config, null>
  /**
   * 修改应用数据
   */
  modifyAppData: ApplyModify<
    typeof Runner.prototype.appData,
    {
      cwd: string
    }
  >
  /**
   * 应用检查事件
   */
  onCheck: ApplyEvent<{
    releaseTypeOrVersion: ReleaseType | string
  }>
  /**
   * 应用启动事件
   */
  onStart: ApplyEvent<null>
  /**
   * 获取需要升级的版本
   */
  getIncrementVersion: ApplyGet<
    {
      releaseTypeOrVersion: ReleaseType | string
    },
    string
  >
  /**
   * 写版本前事件
   */
  onBeforeBumpVersion: ApplyEvent<ReturnType<typeof parseVersion>>
  /**
   * 写版本事件
   */
  onBumpVersion: ApplyEvent<ReturnType<typeof parseVersion>>
  /**
   * 写版本前后事件
   */
  onAfterBumpVersion: ApplyEvent<ReturnType<typeof parseVersion>>
  /**
   * 获取更新日志
   */
  getChangelog: ApplyGet<ReturnType<typeof parseVersion>, string>
  /**
   * 发布前事件
   */
  onBeforeRelease: ApplyEvent<
    ReturnType<typeof parseVersion> & {
      changelog: string
    }
  >
  /**
   * 发布事件
   */
  onRelease: ApplyEvent<
    ReturnType<typeof parseVersion> & {
      changelog: string
    }
  >
  /**
   * 发布前后事件
   */
  onAfterRelease: ApplyEvent<
    ReturnType<typeof parseVersion> & {
      changelog: string
    }
  >
  // #endregion

  // #region 插件方法
  step: (msg: string) => void
  // #endregion
}
