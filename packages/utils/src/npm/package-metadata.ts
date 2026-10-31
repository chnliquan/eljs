import { addAbortSignal, type Readable } from 'node:stream'
import { finished } from 'node:stream/promises'
import urllib, { ProxyAgent } from 'urllib'

import { UtilsError } from '../error'
import type { OmitIndexSignature, PackageJson } from '../types'
import { getNpmRegistry } from './registry-cli'
import { getNpmRequestConfig } from './request-config'

/**
 * npm 精确 semver 版本元数据，包名须匹配查询，下载地址必需，摘要与体积信息可缺省
 *
 * @see https://github.com/npm/registry/blob/main/docs/REGISTRY-API.md#package
 */
interface NpmPackageVersion extends OmitIndexSignature<PackageJson> {
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
}

/**
 * npm 包级元数据，允许空版本集合或尚未设置标签的包
 * @remarks 顶层不要求版本或制品信息，各版本条目的包名与顶层一致，映射键与条目的精确版本一致
 */
export interface NpmPackage extends Omit<
  NpmPackageVersion,
  'version' | 'dist'
> {
  /** 部分 registry 附带的默认版本号 */
  version?: string

  /** 部分 registry 附带的默认版本制品信息 */
  dist?: NpmPackageVersion['dist']

  /** registry 中版本标签到精确版本的映射 */
  'dist-tags': {
    /** 默认稳定版本标签，尚未设置时不存在 */
    latest?: string
    /** 其他稳定或预发布标签 */
    [key: string]: string | undefined
  }

  /** registry 中精确版本到版本元数据的映射 */
  versions: {
    [version: string]: NpmPackageVersion
  }
}

/**
 * npm 包元数据查询选项
 *
 * @remarks
 * `registry` 未指定时按当前 npm 配置解析默认地址，
 * 认证信息仅对目标 registry 生效，跨 origin 后仅保留非凭证头且不恢复凭据
 * 每跳仅允许不含用户信息的 HTTP(S) 地址，拒绝 HTTPS 降级，最多跳转 20 次
 */
export interface NpmPackageQueryOptions {
  /** 用于解析项目级 `.npmrc` 的目录 */
  cwd?: string

  /** 显式指定的 registry 地址 */
  registry?: string

  /** 配置解析、全部跳转及响应读取的总超时，单位为毫秒，默认 10000，必须为 0 至 2147483647 的整数，0 关闭总超时 */
  timeout?: number

  /** 与总超时合并的取消信号，不修改调用方信号或原因，取消时在请求错误中保留原始原因 */
  signal?: AbortSignal

  /** 解压后的元数据读取上限，单位为字节，默认 32 MiB，必须为正安全整数 */
  maxBytes?: number
}

/**
 * 指定版本的 npm 包元数据查询选项
 */
export interface NpmPackageVersionQueryOptions extends NpmPackageQueryOptions {
  /** 精确版本号或 registry 支持的版本标识 */
  version: string
}

/**
 * 获取指定版本的 npm 包元数据
 * @remarks
 * 版本查询重载优先匹配，显式类型的选项变量也返回版本级元数据
 * 响应包名必须匹配查询，精确 semver 查询必须匹配返回版本（兼容 `v` 前缀），标签可解析为精确版本
 * 响应流结束后才关闭本次请求创建的代理，畸形 registry 或代理地址使用不含原始 URL 的固定诊断
 * @param name - 包名
 * @param options - 指定版本的 npm 包查询选项
 * @returns 版本元数据，包或版本不存在时返回 `null`
 * @throws registry 请求、超时、取消、跳转、读取上限或响应结构异常时抛出 `UtilsError`
 * @throws 超时或读取上限配置无效时抛出 `RangeError`
 * @throws 代理关闭失败时传播清理错误，与请求同时失败时通过 `AggregateError` 保留两个原因
 */
export async function getNpmPackage(
  name: string,
  options: NpmPackageVersionQueryOptions,
): Promise<NpmPackage['versions'][string] | null>
/**
 * 获取 npm 包元数据
 * @remarks
 * 响应包名及所有版本条目的包名必须匹配查询，版本映射键必须等于条目的精确版本
 * 响应流结束后才关闭本次请求创建的代理，包级顶层版本与制品信息可缺省
 * 畸形 registry 或代理地址使用不含原始 URL 的固定诊断
 * @param name - 包名
 * @param options - npm 包查询选项
 * @returns 包级元数据，包不存在时返回 `null`
 * @throws registry 请求、超时、取消、跳转、读取上限或响应结构异常时抛出 `UtilsError`
 * @throws 超时或读取上限配置无效时抛出 `RangeError`
 * @throws 代理关闭失败时传播清理错误，与请求同时失败时通过 `AggregateError` 保留两个原因
 */
export async function getNpmPackage(
  name: string,
  options?: NpmPackageQueryOptions,
): Promise<NpmPackage | null>
export async function getNpmPackage(
  name: string,
  options?: NpmPackageQueryOptions & { version?: string },
): Promise<NpmPackage | NpmPackageVersion | null> {
  const timeout = options?.timeout ?? 10_000
  const maxBytes = options?.maxBytes ?? 32 * 1024 * 1024
  if (!Number.isInteger(timeout) || timeout < 0 || timeout > 2_147_483_647) {
    throw new RangeError('timeout must be an integer between 0 and 2147483647')
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new RangeError('maxBytes must be a positive safe integer')
  }
  const controller = new AbortController()
  const timer =
    timeout > 0
      ? setTimeout(
          () =>
            controller.abort(
              new DOMException(
                'npm registry request timed out',
                'TimeoutError',
              ),
            ),
          timeout,
        )
      : undefined
  timer?.unref()
  const signal = options?.signal
    ? AbortSignal.any([controller.signal, options.signal])
    : controller.signal
  // urllib 会给取消原因添加传输字段，流也可能传递该原因；两者只接收本次请求独有的可扩展错误
  const transportController = new AbortController()
  const onAbort = () =>
    transportController.abort(new Error('npm registry request aborted'))
  signal.addEventListener('abort', onAbort, { once: true })
  if (signal.aborted) {
    onAbort()
  }
  let dispatcher: ProxyAgent | undefined
  let body: Readable | undefined
  let requestError: unknown
  let result: NpmPackage | NpmPackageVersion | null | undefined

  try {
    signal.throwIfAborted()
    const registry =
      options?.registry ||
      (await getNpmRegistry(
        { cwd: options?.cwd, signal },
        getPackageScope(name),
      ))
    let url: URL
    try {
      url = new URL(
        `${registry.replace(/\/+$/, '')}/${encodeURIComponent(name).replace(/^%40/, '@')}${
          options?.version ? `/${encodeURIComponent(options.version)}` : ''
        }`,
      )
    } catch {
      // URL 解析错误的 input 和 message 可能包含凭据，不能挂到外层 cause
      throw registryError('PROTOCOL', 'Invalid npm registry URL')
    }
    validateRegistryUrl(url)
    const requestConfig = await awaitRegistryConfiguration(
      getNpmRequestConfig(url.href, options?.cwd),
      signal,
    )
    signal.throwIfAborted()
    if (requestConfig.proxy) {
      try {
        const proxyUrl = new URL(requestConfig.proxy)
        if (!['http:', 'https:'].includes(proxyUrl.protocol)) {
          throw new Error('Unsupported proxy protocol')
        }
        dispatcher = new ProxyAgent(requestConfig.proxy)
      } catch {
        throw registryError('PROTOCOL', 'Invalid npm registry proxy URL')
      }
    }
    let headers = requestConfig.headers

    for (let redirects = 0; ; redirects++) {
      signal.throwIfAborted()
      const response = await urllib.request(url.href, {
        // urllib 的标量 0 会回退到默认 idle 超时，用双零关闭它并由共用信号控制总时限
        timeout: [0, 0],
        dataType: 'stream',
        compressed: true,
        followRedirect: false,
        headers: { accept: 'application/json', ...headers },
        ...(dispatcher ? { dispatcher } : {}),
        signal: transportController.signal,
      })
      body = addAbortSignal(transportController.signal, response.res)
      const location = response.headers.location
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (!location || redirects >= 20) {
          throw registryError(
            'REDIRECT',
            'npm registry redirect is missing a location or exceeds the limit',
          )
        }
        let nextUrl: URL
        try {
          nextUrl = new URL(location, url)
        } catch {
          throw registryError(
            'REDIRECT',
            'npm registry returned an invalid redirect URL',
          )
        }
        validateRegistryUrl(nextUrl, url)
        if (nextUrl.origin !== url.origin) {
          headers = stripRegistryCredentials(headers)
        }
        // 不消费中间响应，避免无限响应体阻塞下一跳或代理清理
        await discardRegistryBody(body)
        body = undefined
        url = nextUrl
        continue
      }
      if (response.status === 404) {
        result = null
      } else if (response.status < 200 || response.status >= 300) {
        throw new UtilsError(
          'ERR_NPM_REGISTRY_HTTP_STATUS',
          `npm registry request failed with status ${response.status}`,
          {
            details: { packageName: name, status: response.status },
            operation: 'npm.getPackage',
          },
        )
      } else {
        const chunks: Buffer[] = []
        let size = 0
        for await (const chunk of body) {
          signal.throwIfAborted()
          const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
          size += data.length
          if (size > maxBytes) {
            throw registryError(
              'MAX_BYTES',
              'npm registry metadata exceeds maxBytes',
            )
          }
          chunks.push(data)
        }
        signal.throwIfAborted()
        let data: unknown
        try {
          data = JSON.parse(Buffer.concat(chunks, size).toString('utf8'))
        } catch {
          throw registryError('RESPONSE', 'npm registry returned invalid JSON')
        }
        if (!isValidMetadata(data, name, options?.version)) {
          throw registryError(
            'RESPONSE',
            'npm registry returned invalid package metadata',
          )
        }
        result = data
      }
      break
    }
  } catch (error) {
    const cause = signal.aborted ? signal.reason : error
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

  // 先结束响应生命周期，再关闭代理，最后释放总超时计时器
  await discardRegistryBody(body)
  const cleanupError = await closeDispatcher(dispatcher)
  signal.removeEventListener('abort', onAbort)
  clearTimeout(timer)

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

  return result as NpmPackage | NpmPackageVersion | null
}

/**
 * 校验每跳地址的信任边界，禁止 URL 凭据、非 HTTP(S) 协议和 HTTPS 降级
 * @param url - 待访问地址
 * @param previous - 上一跳地址，初始请求不传
 * @throws 不满足安全约束时抛出协议或重定向错误
 */
function validateRegistryUrl(url: URL, previous?: URL): void {
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    (previous?.protocol === 'https:' && url.protocol === 'http:')
  ) {
    throw registryError(
      previous ? 'REDIRECT' : 'PROTOCOL',
      'Unsupported npm registry URL',
    )
  }
}

/**
 * 沿用下载请求的非凭证头白名单，跨 origin 后不恢复原始凭据
 * @param headers - 上一跳请求头
 * @returns 下一跳可安全转发的请求头
 */
function stripRegistryCredentials(
  headers?: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers ?? {}).filter(([name]) =>
      [
        'accept',
        'accept-encoding',
        'accept-language',
        'user-agent',
        'range',
      ].includes(name.toLowerCase()),
    ),
  )
}

/**
 * 取消不再消费的响应并等待关闭，主动销毁导致的流错误不替代原始请求结果
 * @param body - 中间、失败或已经消费完的响应流
 * @returns 流生命周期结束后完成
 */
async function discardRegistryBody(body?: Readable): Promise<void> {
  if (!body) {
    return
  }
  const completion = finished(body, { cleanup: true }).catch(() => undefined)
  body.destroy()
  await completion
}

/**
 * 将不可信 JSON 按查询身份与层级收窄，允许扩展字段、空集合及缺省的可选摘要
 * @param data - registry JSON 响应
 * @param name - 查询包名，顶层与所有版本条目必须一致
 * @param versionQuery - 精确版本或标签，未指定时校验整个版本映射
 * @returns 响应是否满足对应元数据契约
 */
function isValidMetadata(
  data: unknown,
  name: string,
  versionQuery?: string,
): data is NpmPackage | NpmPackageVersion {
  if (!isRecord(data) || !isNonemptyString(data.name) || data.name !== name) {
    return false
  }
  if (versionQuery) {
    const exactVersion = normalizeExactVersion(versionQuery)
    return (
      isValidVersion(data, name) &&
      (exactVersion === undefined ||
        normalizeExactVersion(data.version) === exactVersion)
    )
  }
  return (
    isRecord(data.versions) &&
    Object.entries(data.versions).every(
      ([version, value]) =>
        isValidVersion(value, name) && version === value.version,
    ) &&
    isRecord(data['dist-tags']) &&
    Object.values(data['dist-tags']).every(isNonemptyString) &&
    (data.version === undefined || isNonemptyString(data.version)) &&
    (data.dist === undefined || isValidDist(data.dist))
  )
}

/**
 * 每个版本必须携带匹配的包名、精确 semver 版本和可下载制品，摘要只验证结构而不验证内容
 * @param data - 不可信版本条目
 * @param name - 查询包名
 * @returns 是否可作为版本元数据使用
 */
function isValidVersion(
  data: unknown,
  name: string,
): data is NpmPackageVersion {
  return (
    isRecord(data) &&
    data.name === name &&
    isNonemptyString(data.version) &&
    normalizeExactVersion(data.version) !== undefined &&
    isValidDist(data.dist)
  )
}

/**
 * 识别精确 semver，兼容 npm 的 `v` 前缀，保留预发布及构建标识以避免接受其他制品
 * @remarks 数字版本段不能含前导零或超出安全整数，纯数字预发布标识不能含前导零
 * @param version - 查询标识或响应版本
 * @returns 去掉 `v` 前缀的精确版本，标签、范围或无效版本返回 `undefined`
 */
function normalizeExactVersion(version: string): string | undefined {
  const match =
    /^v?((0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*))?(?:\+[\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*)?)$/u.exec(
      version,
    )
  if (
    !match ||
    match[0] !== version ||
    !match.slice(2, 5).every(part => Number.isSafeInteger(Number(part))) ||
    match[5]?.split('.').some(part => /^\d+$/u.test(part) && /^0\d/u.test(part))
  ) {
    return undefined
  }
  return match[1]
}

/**
 * 允许缺省摘要及体积，存在时要求 SRI、SHA-1 或非负安全整数字节数
 * @remarks SRI 允许算法扩展和多个摘要，实际下载时再检查算法支持与摘要匹配
 * @param data - 不可信制品信息
 * @returns 是否满足制品结构
 */
function isValidDist(data: unknown): boolean {
  if (!isRecord(data) || !isNonemptyString(data.tarball)) {
    return false
  }
  try {
    const url = new URL(data.tarball)
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      return false
    }
  } catch {
    return false
  }
  return (
    (data.shasum === undefined ||
      (typeof data.shasum === 'string' &&
        /^[a-f\d]{40}$/iu.test(data.shasum))) &&
    (data.integrity === undefined ||
      (isNonemptyString(data.integrity) &&
        data.integrity.trim().split(/\s+/u).every(isValidIntegrityToken))) &&
    ['size', 'unpackedSize'].every(
      key =>
        data[key] === undefined ||
        (Number.isSafeInteger(data[key]) && (data[key] as number) >= 0),
    )
  )
}

/**
 * 校验 SRI 的 Base64 编码及常见算法的摘要长度，允许无填充编码和算法扩展
 * @param token - 单个 SRI 摘要，可附带标准选项
 * @returns 摘要是否满足结构约束
 */
function isValidIntegrityToken(token: string): boolean {
  const match = /^([a-z][a-z\d]*)-([a-z\d+/]+={0,2})(?:\?[^\s]+)?$/iu.exec(
    token,
  )
  if (!match) {
    return false
  }
  const digest = Buffer.from(match[2], 'base64')
  if (
    digest.toString('base64').replace(/=+$/u, '') !==
    match[2].replace(/=+$/u, '')
  ) {
    return false
  }
  const sizes: Record<string, number> = {
    sha1: 20,
    sha256: 32,
    sha384: 48,
    sha512: 64,
  }
  const expectedSize = sizes[match[1].toLowerCase()]
  return expectedSize === undefined || digest.length === expectedSize
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function registryError(
  reason: 'PROTOCOL' | 'REDIRECT' | 'MAX_BYTES' | 'RESPONSE',
  message: string,
): UtilsError {
  return new UtilsError(
    reason === 'RESPONSE' || reason === 'MAX_BYTES'
      ? 'ERR_NPM_REGISTRY_RESPONSE'
      : 'ERR_NPM_REGISTRY_REQUEST',
    message,
    { details: { reason }, operation: 'npm.getPackage' },
  )
}

/**
 * 配置读取无法取消底层文件 I/O，取消时立即结束等待并移除信号监听
 * @typeParam T - 配置读取结果
 * @param pending - 已开始的配置读取
 * @param signal - 查询共用的取消信号
 * @returns 取消前读取到的配置
 * @throws 取消原因或配置读取错误
 */
async function awaitRegistryConfiguration<T>(
  pending: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  let onAbort: () => void = () => undefined
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
    if (signal.aborted) {
      onAbort()
    }
  })
  try {
    return await Promise.race([pending, aborted])
  } finally {
    signal.removeEventListener('abort', onAbort)
  }
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
