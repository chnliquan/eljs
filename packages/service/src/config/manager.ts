import { isPathExistsSync, loadTsSync } from '@eljs/utils'
import assert from 'assert'
import deepMerge from 'deepmerge'
import joi from 'joi'
import { EOL } from 'os'
import { join } from 'path'

import { DEFAULT_CONFIG_FILES, LOCAL_EXT, SHORT_ENV } from '../const'
import { Env } from '../types/env'
import { addExt, getAbsFiles } from './utils'

export interface ConfigManagerOpts {
  /**
   * 当前路径
   */
  cwd: string
  /**
   * 当前环境
   */
  env: Env
  /**
   * 默认的配置文件列表
   */
  defaultConfigFiles?: string[]
}

export class ConfigManager {
  public opts: ConfigManagerOpts
  /**
   * 主配置文件地址
   */
  public mainConfigFile: string | null

  public constructor(opts: ConfigManagerOpts) {
    this.opts = opts
    this.mainConfigFile = ConfigManager.getMainConfigFile(this.opts)
  }

  public getUserConfig() {
    const configFiles = ConfigManager.getConfigFiles({
      mainConfigFile: this.mainConfigFile,
      env: this.opts.env,
    })

    return ConfigManager.getUserConfig({
      configFiles: getAbsFiles({
        files: configFiles,
        cwd: this.opts.cwd,
      }),
    })
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public getConfig(opts: { schemas: Record<string, any> }) {
    const { config, files } = this.getUserConfig()

    ConfigManager.validateConfig({ config, schemas: opts.schemas })

    return {
      config,
      files,
    }
  }

  public static getMainConfigFile(opts: {
    cwd: string
    defaultConfigFiles?: string[]
  }) {
    let mainConfigFile = null

    for (const configFile of opts.defaultConfigFiles || DEFAULT_CONFIG_FILES) {
      const absConfigFile = join(opts.cwd, configFile)
      if (isPathExistsSync(absConfigFile)) {
        mainConfigFile = absConfigFile
        break
      }
    }

    return mainConfigFile
  }

  public static getConfigFiles(opts: {
    mainConfigFile: string | null
    env: Env
  }) {
    const configFiles: string[] = []
    const { mainConfigFile } = opts

    if (mainConfigFile) {
      const env = SHORT_ENV[opts.env] || opts.env

      configFiles.push(
        ...[
          mainConfigFile,
          env && addExt({ file: mainConfigFile, ext: `.${env}` }),
        ].filter(Boolean),
      )

      if (opts.env === Env.development) {
        configFiles.push(addExt({ file: mainConfigFile, ext: LOCAL_EXT }))
      }
    }

    return configFiles
  }

  public static getUserConfig(opts: { configFiles: string[] }) {
    const files: string[] = []
    let config = {
      presets: [],
      plugins: [],
    }

    for (const configFile of opts.configFiles) {
      if (isPathExistsSync(configFile)) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ret = loadTsSync(configFile) as { default: any }
          config = deepMerge(config, ret.default)
        } catch (e) {
          throw new Error(`Parse config file failed: [${configFile}]`, {
            cause: e,
          })
        }
      }

      files.push(configFile)
    }

    return {
      config,
      files,
    }
  }

  public static validateConfig(opts: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: Record<string, any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schemas: Record<string, any>
  }) {
    const errors = new Map<string, Error>()
    const configKeys = new Set(Object.keys(opts.config))

    for (const key of Object.keys(opts.schemas)) {
      configKeys.delete(key)

      if (!opts.config[key]) {
        continue
      }

      const schema = opts.schemas[key](joi)
      // invalid schema
      assert(joi.isSchema(schema), `schema for config ${key} is not valid.`)
      const { error } = schema.validate(opts.config[key])

      if (error) {
        errors.set(key, error)
      }
    }

    // invalid config values
    assert(
      errors.size === 0,
      `Invalid config values: ${Array.from(errors.keys()).join(', ')}
${Array.from(errors.keys()).map(key => {
  return `Invalid value for ${key}:${EOL}${(errors.get(key) as Error).message}`
})}`,
    )
    // invalid config keys
    assert(
      configKeys.size === 0,
      `Invalid config keys: ${Array.from(configKeys).join(', ')}`,
    )
  }
}
