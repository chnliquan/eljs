import { parse } from 'ini'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'

/**
 * npm 请求使用的认证与代理配置
 *
 */
export interface NpmRequestConfig {
  /** 仅对目标 registry 生效的 HTTP 请求头 */
  headers?: Record<string, string>
  /** 经过 `no-proxy` 规则过滤后的代理地址 */
  proxy?: string
}

/**
 * 从项目级和用户级 npm 配置中解析指定地址可安全使用的认证与代理信息
 *
 * @remarks
 * 认证信息严格按目标地址的 host 与路径匹配，避免 registry 凭据被转发到其他 tarball 主机
 *
 * @param url - 即将请求的 registry 或 tarball 地址
 * @param cwd - 用于查找项目级 `.npmrc` 的目录
 * @returns 可传给 HTTP 客户端的请求配置
 */
export async function getNpmRequestConfig(
  url: string,
  cwd = process.cwd(),
): Promise<NpmRequestConfig> {
  const config = await readNpmConfig(cwd)
  const target = new URL(url)
  const authPrefix = findAuthPrefix(config, target)
  const headers = authPrefix ? getAuthHeaders(config, authPrefix) : undefined
  const proxy = getProxy(config, target)

  return {
    ...(headers ? { headers } : {}),
    ...(proxy ? { proxy } : {}),
  }
}

/** 从可信度不一的 `.npmrc` 文件合并得到的原始配置 */
type NpmConfig = Record<string, unknown>

async function readNpmConfig(cwd: string): Promise<NpmConfig> {
  const files = getNpmConfigFiles(cwd)
  const config: NpmConfig = {}

  for (const file of files) {
    try {
      const source = await readFile(file, 'utf8')
      Object.assign(config, parse(expandEnvironmentVariables(source)))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
  }

  return config
}

function getNpmConfigFiles(cwd: string): string[] {
  const files = [
    process.env.NPM_CONFIG_GLOBALCONFIG,
    process.env.NPM_CONFIG_USERCONFIG || path.join(homedir(), '.npmrc'),
  ].filter((file): file is string => Boolean(file))
  const directories: string[] = []
  let current = path.resolve(cwd)

  while (true) {
    directories.push(current)
    const parent = path.dirname(current)

    if (parent === current) {
      break
    }

    current = parent
  }

  for (const directory of directories.reverse()) {
    files.push(path.join(directory, '.npmrc'))
  }

  return [...new Set(files.map(file => path.resolve(file)))]
}

function expandEnvironmentVariables(source: string): string {
  return source.replace(/\$\{([^}]+)\}/gu, (_match, name: string) => {
    return process.env[name] ?? ''
  })
}

function findAuthPrefix(config: NpmConfig, target: URL): string | undefined {
  const pathname = target.pathname.endsWith('/')
    ? target.pathname
    : `${target.pathname}/`
  const candidates = Object.keys(config)
    .filter(key => key.startsWith(`//${target.host}/`))
    .map(key => key.replace(/:(?:_authToken|_auth|username|_password)$/u, ''))
    .filter(prefix => pathname.startsWith(prefix.slice(target.host.length + 2)))
    .sort((left, right) => right.length - left.length)

  return candidates.at(0)
}

function getAuthHeaders(
  config: NpmConfig,
  prefix: string,
): Record<string, string> | undefined {
  const token = getString(config[`${prefix}:_authToken`])

  if (token) {
    return { authorization: `Bearer ${token}` }
  }

  const encodedAuth = getString(config[`${prefix}:_auth`])

  if (encodedAuth) {
    return { authorization: `Basic ${encodedAuth}` }
  }

  const username = getString(config[`${prefix}:username`])
  const encodedPassword = getString(config[`${prefix}:_password`])

  if (username && encodedPassword) {
    const password = Buffer.from(encodedPassword, 'base64').toString('utf8')
    return {
      authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
    }
  }

  return undefined
}

function getProxy(config: NpmConfig, target: URL): string | undefined {
  const noProxy =
    getString(config['no-proxy']) ||
    process.env.NO_PROXY ||
    process.env.no_proxy ||
    ''

  if (matchesNoProxy(target, noProxy)) {
    return undefined
  }

  const secureProxy =
    getString(config['https-proxy']) ||
    process.env.NPM_CONFIG_HTTPS_PROXY ||
    process.env.HTTPS_PROXY ||
    process.env.https_proxy
  const plainProxy =
    getString(config.proxy) ||
    process.env.NPM_CONFIG_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy

  return target.protocol === 'https:' ? secureProxy || plainProxy : plainProxy
}

function matchesNoProxy(target: URL, value: string): boolean {
  const hostname = target.hostname.toLowerCase()
  const port = target.port || (target.protocol === 'https:' ? '443' : '80')

  return value
    .split(',')
    .map(entry => entry.trim().toLowerCase())
    .filter(Boolean)
    .some(entry => {
      if (entry === '*') {
        return true
      }

      const [entryHostname, entryPort] = entry.split(':')

      if (entryPort && entryPort !== port) {
        return false
      }

      const normalizedHostname = entryHostname.replace(/^\./u, '')
      return (
        hostname === normalizedHostname ||
        hostname.endsWith(`.${normalizedHostname}`)
      )
    })
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined
}
