import { isPlainObject } from '@eljs/utils/guards'
import { fileLoaders, fileLoadersSync, loadJsSync } from '@eljs/utils/loader'
import { deepMerge } from '@eljs/utils/object'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
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

  if (!isPlainObject(actualConfig)) {
    throw new ConfigLoadError(
      `Config ${configFile} must export a plain object`,
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

/**
 * 校验并复制调用方提供的默认配置
 *
 * @remarks
 * 默认配置与文件导出共享同一根对象信任边界，不能通过对象展开静默改变数组或类实例的结构
 *
 * @typeParam T - 调用方声明的配置类型
 * @param defaultConfig - 调用方提供的默认配置
 * @returns 默认配置的浅层副本，未提供时返回 `null`
 * @throws {@link ConfigLoadError} 默认配置不是普通对象时抛出
 */
function normalizeDefaultConfig<T extends object>(
  defaultConfig: T | undefined,
): T | null {
  if (defaultConfig === undefined) {
    return null
  }

  if (!isPlainObject(defaultConfig)) {
    throw new ConfigLoadError('Default config must be a plain object', {
      code: ConfigErrorCode.InvalidConfig,
      configFile: '<default>',
    })
  }

  return { ...defaultConfig } as T
}

/**
 * 绕过 Node.js 模块缓存重新加载 JavaScript 配置
 *
 * @remarks
 * `.cjs` 使用同步 fresh require，`.mjs` 使用带唯一查询参数的动态导入
 * 格式不明确的 `.js` 只清除可能存在的 CommonJS 缓存条目，再通过动态导入兼容 package-scoped ESM
 * 清除缓存时不执行模块，避免支持同步 `require(esm)` 的 Node.js 重复求值 ESM 入口
 * 这里只重新求值入口文件，入口引用的传递依赖仍遵循 Node.js 模块缓存
 */
async function loadJavaScriptFresh(
  configFile: string,
  format: string,
): Promise<unknown> {
  if (format === '.cjs') {
    return loadJsSync(configFile)
  }

  if (format === '.js') {
    const localRequire = createRequire(pathToFileURL(configFile))

    // 只删除缓存而不执行入口；动态导入会按文件所属 package scope 选择 CJS 或 ESM
    delete localRequire.cache[localRequire.resolve(configFile)]
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

    if (!isPlainObject(mergedConfig)) {
      throw new TypeError('Config merge must return a plain object')
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
  inputConfigFiles: readonly string[],
  loadedConfigFiles: readonly string[],
  validate?: ConfigValidator,
): T | null {
  if (!config || !validate) {
    return config
  }

  const validationTarget = loadedConfigFiles.at(-1) ?? '<default>'

  try {
    const validatedConfig = validate(config, {
      configFiles: inputConfigFiles,
      loadedConfigFiles,
    })

    if (!isPlainObject(validatedConfig)) {
      throw new TypeError(
        'Config validator must synchronously return a plain object',
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
  const loadedConfigFiles: string[] = []
  const { merge, reload, validate } = options
  let config = normalizeDefaultConfig(defaultConfig)

  for (const configFile of inputConfigFiles) {
    if (!(await isConfigPathAvailable(configFile))) {
      continue
    }

    const format = extname(configFile) as keyof typeof fileLoaders
    const loader = fileLoaders[format]

    if (!loader) {
      throw createUnsupportedFormatError(configFile, false)
    }

    let content: unknown

    try {
      content =
        reload && JAVASCRIPT_EXTENSIONS.has(format)
          ? await loadJavaScriptFresh(configFile, format)
          : await loader(configFile)
    } catch (error) {
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

    const actualConfig = normalizeConfigExport(content, configFile)

    if (actualConfig == null) {
      continue
    }

    loadedConfigFiles.push(configFile)

    config = config
      ? (mergeConfigObjects(config, actualConfig, configFile, merge) as T)
      : (actualConfig as T)
  }

  return validateConfigObject(
    config,
    inputConfigFiles,
    Object.freeze(loadedConfigFiles),
    validate,
  )
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
  const loadedConfigFiles: string[] = []
  const { merge, validate } = options
  let config = normalizeDefaultConfig(defaultConfig)

  for (const configFile of inputConfigFiles) {
    if (!isConfigPathAvailableSync(configFile)) {
      continue
    }

    const format = extname(configFile) as keyof typeof fileLoadersSync
    const loader = fileLoadersSync[format]

    if (!loader) {
      throw createUnsupportedFormatError(configFile, true)
    }

    let content: unknown

    try {
      content = loader(configFile)
    } catch (error) {
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

    const actualConfig = normalizeConfigExport(content, configFile)

    if (actualConfig == null) {
      continue
    }

    loadedConfigFiles.push(configFile)

    config = config
      ? (mergeConfigObjects(config, actualConfig, configFile, merge) as T)
      : (actualConfig as T)
  }

  return validateConfigObject(
    config,
    inputConfigFiles,
    Object.freeze(loadedConfigFiles),
    validate,
  )
}
