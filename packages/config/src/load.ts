import { fileLoaders, fileLoadersSync, loadJsSync } from '@eljs/utils/file'
import { deepMerge } from '@eljs/utils/object'
import { randomUUID } from 'node:crypto'
import { extname } from 'node:path'
import { pathToFileURL } from 'node:url'

import { ConfigErrorCode, ConfigLoadError } from './errors'
import { isConfigPathAvailable, isConfigPathAvailableSync } from './path'
import type { ConfigLoadOptions, ConfigMerge, ConfigValidator } from './types'

const MODULE_EXTENSIONS = new Set(['.cjs', '.js', '.mjs', '.ts'])
const JAVASCRIPT_EXTENSIONS = new Set(['.cjs', '.js', '.mjs'])

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null
}

function isModuleNamespace(
  value: unknown,
): value is Record<PropertyKey, unknown> {
  return (
    isObject(value) &&
    (value as Record<PropertyKey, unknown>)[Symbol.toStringTag] === 'Module'
  )
}

/**
 * 将解析器返回值收敛为配置对象
 *
 * @remarks
 * 模块命名空间与 TypeScript 转译产物需要解包默认导出，JSON 和 YAML 中名为 `default` 的普通字段必须保留
 */
function normalizeConfigExport(
  content: unknown,
  configFile: string,
): object | null {
  if (content == null) {
    return null
  }

  const format = extname(configFile)
  let actualConfig: unknown = content

  if (MODULE_EXTENSIONS.has(format)) {
    if (isModuleNamespace(actualConfig) && 'default' in actualConfig) {
      actualConfig = actualConfig.default
    }

    if (
      isObject(actualConfig) &&
      '__esModule' in actualConfig &&
      actualConfig.__esModule === true &&
      'default' in actualConfig
    ) {
      actualConfig = actualConfig.default
    }
  }

  if (actualConfig == null) {
    return null
  }

  if (!isObject(actualConfig)) {
    throw new ConfigLoadError(
      `Config ${configFile} must export an object, received ${typeof actualConfig}`,
      {
        code: ConfigErrorCode.InvalidConfig,
        configFile,
        format,
      },
    )
  }

  return actualConfig
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isEsmRequireError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (('code' in error && error.code === 'ERR_REQUIRE_ESM') ||
      error.message.includes('require() of ES Module'))
  )
}

/**
 * 绕过 Node.js 模块缓存重新加载 JavaScript 配置
 *
 * @remarks
 * CommonJS 使用同步 fresh require，原生 ESM 使用带唯一查询参数的动态导入
 */
async function loadJavaScriptFresh(
  configFile: string,
  format: string,
): Promise<unknown> {
  if (format !== '.mjs') {
    try {
      return loadJsSync(configFile)
    } catch (error) {
      if (!isEsmRequireError(error)) {
        throw error
      }
    }
  }

  const url = pathToFileURL(configFile)
  url.searchParams.set('eljs-reload', randomUUID())
  return import(url.href)
}

/**
 * 应用默认或调用方提供的合并策略
 *
 * @remarks
 * 合并函数不得改变对象信任边界，返回非对象或抛出异常都会转换为稳定配置错误
 */
function mergeConfigObjects(
  baseConfig: object,
  overrideConfig: object,
  configFile: string,
  merge?: ConfigMerge,
): object {
  try {
    const mergedConfig = merge
      ? merge(baseConfig, overrideConfig)
      : deepMerge(baseConfig, overrideConfig)

    if (!isObject(mergedConfig)) {
      throw new TypeError('Config merge must return an object')
    }

    return mergedConfig
  } catch (error) {
    throw new ConfigLoadError(
      `Merge config ${configFile} failed: ${getErrorMessage(error)}`,
      {
        cause: error,
        code: ConfigErrorCode.MergeFailed,
        configFile,
      },
    )
  }
}

/**
 * 在完整合并后执行同步验证
 *
 * @remarks
 * 同步和异步加载共用这一边界，因此 Promise 返回值会被拒绝
 */
function validateConfigObject<T extends object>(
  config: T | null,
  configFiles: readonly string[],
  validate?: ConfigValidator,
): T | null {
  if (!config || !validate) {
    return config
  }

  const validationTarget = configFiles.at(-1) ?? '<default>'

  try {
    const validatedConfig = validate(config, { configFiles })

    if (
      !isObject(validatedConfig) ||
      ('then' in validatedConfig && typeof validatedConfig.then === 'function')
    ) {
      throw new TypeError(
        'Config validator must synchronously return an object',
      )
    }

    return validatedConfig as T
  } catch (error) {
    throw new ConfigLoadError(
      `Validate config ${validationTarget} failed: ${getErrorMessage(error)}`,
      {
        cause: error,
        code: ConfigErrorCode.ValidationFailed,
        configFile: validationTarget,
      },
    )
  }
}

function createUnsupportedFormatError(
  configFile: string,
  sync: boolean,
): ConfigLoadError {
  const format = extname(configFile)
  const syncUnsupported = sync && format === '.mjs'

  return new ConfigLoadError(
    syncUnsupported
      ? `Config format ${format} cannot be loaded synchronously: ${configFile}`
      : `Unsupported config format ${format || '<none>'}: ${configFile}`,
    {
      code: syncUnsupported
        ? ConfigErrorCode.SyncFormatUnsupported
        : ConfigErrorCode.UnsupportedFormat,
      configFile,
      format,
    },
  )
}

/**
 * 按输入顺序异步加载、合并并验证配置文件
 *
 * @remarks
 * 这是 `ConfigManager` 静态与实例 API 共享的内部异步契约
 *
 * @internal
 */
export async function loadConfigFiles<T extends object>(
  configFiles: readonly string[],
  defaultConfig?: T,
  options: ConfigLoadOptions = {},
): Promise<T | null> {
  const inputConfigFiles = Object.freeze([...configFiles])
  const { merge, reload, validate } = options
  let config: T | null = defaultConfig ? ({ ...defaultConfig } as T) : null

  for (const configFile of inputConfigFiles) {
    if (!(await isConfigPathAvailable(configFile))) {
      continue
    }

    const format = extname(configFile) as keyof typeof fileLoaders
    const loader = fileLoaders[format]

    if (!loader) {
      throw createUnsupportedFormatError(configFile, false)
    }

    try {
      const content: unknown =
        reload && JAVASCRIPT_EXTENSIONS.has(format)
          ? await loadJavaScriptFresh(configFile, format)
          : await loader(configFile)
      const actualConfig = normalizeConfigExport(content, configFile)

      if (actualConfig == null) {
        continue
      }

      config = config
        ? (mergeConfigObjects(config, actualConfig, configFile, merge) as T)
        : (actualConfig as T)
    } catch (error) {
      if (error instanceof ConfigLoadError) {
        throw error
      }

      throw new ConfigLoadError(
        `Load config ${configFile} failed: ${getErrorMessage(error)}`,
        {
          cause: error,
          code: ConfigErrorCode.LoadFailed,
          configFile,
          format,
        },
      )
    }
  }

  return validateConfigObject(config, inputConfigFiles, validate)
}

/**
 * 按输入顺序同步加载、合并并验证配置文件
 *
 * @remarks
 * 这是 `ConfigManager` 静态与实例 API 共享的内部同步契约
 *
 * @internal
 */
export function loadConfigFilesSync<T extends object>(
  configFiles: readonly string[],
  defaultConfig?: T,
  options: ConfigLoadOptions = {},
): T | null {
  const inputConfigFiles = Object.freeze([...configFiles])
  const { merge, validate } = options
  let config: T | null = defaultConfig ? ({ ...defaultConfig } as T) : null

  for (const configFile of inputConfigFiles) {
    if (!isConfigPathAvailableSync(configFile)) {
      continue
    }

    const format = extname(configFile) as keyof typeof fileLoadersSync
    const loader = fileLoadersSync[format]

    if (!loader) {
      throw createUnsupportedFormatError(configFile, true)
    }

    try {
      const content: unknown = loader(configFile)
      const actualConfig = normalizeConfigExport(content, configFile)

      if (actualConfig == null) {
        continue
      }

      config = config
        ? (mergeConfigObjects(config, actualConfig, configFile, merge) as T)
        : (actualConfig as T)
    } catch (error) {
      if (error instanceof ConfigLoadError) {
        throw error
      }

      throw new ConfigLoadError(
        `Load config ${configFile} failed: ${getErrorMessage(error)}`,
        {
          cause: error,
          code: ConfigErrorCode.LoadFailed,
          configFile,
          format,
        },
      )
    }
  }

  return validateConfigObject(config, inputConfigFiles, validate)
}
