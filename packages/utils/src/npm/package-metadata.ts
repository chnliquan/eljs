import urllib, { ProxyAgent } from 'urllib'

import { UtilsError } from '../error'
import { isString } from '../guards'
import type { OmitIndexSignature, PackageJson } from '../types'
import { getNpmRegistry } from './registry-cli'
import { getNpmRequestConfig } from './request-config'

/**
 * npm 包元数据
 *
 * @see https://github.com/npm/registry/blob/main/docs/REGISTRY-API.md#package
 */
export interface NpmPackage extends OmitIndexSignature<PackageJson> {
  /** registry 返回的精确版本 */
  version: string

  /** npm 包名 */
  name: string

  /** 可下载制品的地址、摘要与体积信息 */
  dist: {
    /** npm 推荐的 Subresource Integrity 摘要 */
    integrity?: string
    /** 兼容旧 registry 的 SHA-1 十六进制摘要 */
    shasum?: string
    /** registry 声明的压缩包字节数 */
    size?: number
    /** tarball 下载地址 */
    tarball: string
    /** 解压后的总字节数 */
    unpackedSize?: number
  }

  /** registry 中版本标签到精确版本的映射 */
  'dist-tags': {
    latest: string
    alpha: string
    beta: string
    next: string
    [key: string]: string
  }

  /** registry 中精确版本到版本元数据的映射 */
  versions: {
    [version: string]: Omit<NpmPackage, 'versions' | 'dist-tags'>
  }
}

/**
 * npm 包元数据查询选项
 */
export interface NpmPackageQueryOptions {
  /** 用于解析项目级 `.npmrc` 的目录 */
  cwd?: string

  /** 显式指定的 registry 地址 */
  registry?: string

  /** registry 请求超时时间，单位为毫秒 */
  timeout?: number

  /** 用于取消 registry 请求的信号 */
  signal?: AbortSignal
}

/**
 * 指定版本的 npm 包元数据查询选项
 */
export interface NpmPackageVersionQueryOptions extends NpmPackageQueryOptions {
  /** 精确版本号或 registry 支持的版本标识 */
  version: string
}

/**
 * 获取 npm 包元数据
 * @param name - 包名
 * @param options - npm 包查询选项
 * @returns 包级元数据，包不存在时返回 `null`
 * @throws registry 请求、HTTP 状态或响应结构异常时抛出错误
 */
export async function getNpmPackage(
  name: string,
  options?: NpmPackageQueryOptions,
): Promise<Omit<NpmPackage, 'version'> | null>
/**
 * 获取指定版本的 npm 包元数据
 * @param name - 包名
 * @param options - 指定版本的 npm 包查询选项
 * @returns 版本元数据，包或版本不存在时返回 `null`
 * @throws registry 请求、HTTP 状态或响应结构异常时抛出错误
 */
export async function getNpmPackage(
  name: string,
  options: NpmPackageVersionQueryOptions,
): Promise<Omit<NpmPackage, 'versions' | 'dist-tags'> | null>
export async function getNpmPackage(
  name: string,
  options?: NpmPackageQueryOptions & { version?: string },
): Promise<NpmPackage | null> {
  let registry = options?.registry

  if (!registry) {
    registry = await getNpmRegistry(
      { cwd: options?.cwd },
      getPackageScope(name),
    )
  }

  let url = `${registry.replace(/\/+$/, '')}/${encodeURIComponent(name).replace(
    /^%40/,
    '@',
  )}`

  if (options?.version) {
    url += `/${options.version}`
  }

  const requestConfig = await getNpmRequestConfig(url, options?.cwd)
  const dispatcher = requestConfig.proxy
    ? new ProxyAgent(requestConfig.proxy)
    : undefined

  let requestError: unknown
  let result: NpmPackage | null | undefined

  try {
    const response = await urllib.request<NpmPackage | string>(url, {
      timeout: options?.timeout ?? 10_000,
      dataType: 'json',
      ...(requestConfig.headers ? { headers: requestConfig.headers } : {}),
      ...(dispatcher ? { dispatcher } : {}),
      ...(options?.signal ? { signal: options.signal } : {}),
    })

    if (response.status === 404) {
      result = null
    } else if (response.status < 200 || response.status >= 300) {
      throw new UtilsError(
        'ERR_NPM_REGISTRY_HTTP_STATUS',
        `npm registry request failed with status ${response.status}`,
        {
          details: {
            packageName: name,
            status: response.status,
          },
          operation: 'npm.getPackage',
        },
      )
    } else if (
      !response.data ||
      isString(response.data) ||
      'error' in response.data ||
      'code' in response.data
    ) {
      throw new UtilsError(
        'ERR_NPM_REGISTRY_RESPONSE',
        'npm registry returned an invalid package metadata response',
        {
          details: { packageName: name },
          operation: 'npm.getPackage',
        },
      )
    } else {
      result = response.data
    }
  } catch (cause) {
    requestError =
      cause instanceof UtilsError
        ? cause
        : new UtilsError(
            'ERR_NPM_REGISTRY_REQUEST',
            'npm registry request failed',
            {
              cause,
              details: { packageName: name },
              operation: 'npm.getPackage',
            },
          )
  }

  const cleanupError = await closeDispatcher(dispatcher)

  if (requestError !== undefined && cleanupError !== undefined) {
    throw new AggregateError(
      [requestError, cleanupError],
      'npm registry request and proxy cleanup both failed',
      { cause: cleanupError },
    )
  }

  if (requestError !== undefined) {
    throw requestError
  }

  if (cleanupError !== undefined) {
    throw cleanupError
  }

  return result as NpmPackage | null
}

/**
 * 从包名提取 npm scope，用于解析 scope 专属 registry
 * @param name - npm 包名
 * @returns 带 `@` 的 scope，无 scope 时返回 `undefined`
 * @internal
 */
function getPackageScope(name: string): string | undefined {
  if (!name.startsWith('@')) {
    return undefined
  }

  const separatorIndex = name.indexOf('/')
  return separatorIndex > 1 ? name.slice(0, separatorIndex) : undefined
}

/**
 * 关闭单次 npm registry 请求创建的代理调度器
 * @param dispatcher - 可选代理调度器
 * @returns 清理异常，成功或无需清理时返回 `undefined`
 * @internal
 */
async function closeDispatcher(
  dispatcher: ProxyAgent | undefined,
): Promise<unknown> {
  if (!dispatcher) {
    return undefined
  }

  try {
    await dispatcher.close()
    return undefined
  } catch (error) {
    return error
  }
}
