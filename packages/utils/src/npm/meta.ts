import { PLATFORM } from '@/constants'
import { run, type RunCommandOptions } from '@/cp'
import { timeout as timeoutWrapper } from '@/promise'
import { isString } from '@/type'
import type { OmitIndexSignature, PackageJson } from '@/types'
import os from 'node:os'
import path from 'node:path'
import urllib from 'urllib'
import which from 'which'

/**
 * 获取 NPM 仓库
 * @param options 可选配置项
 */
export async function getNpmRegistry(
  options?: RunCommandOptions,
): Promise<string> {
  return run('npm', ['config', 'get', 'registry'], options).then(data => {
    return data.stdout.trim()
  })
}

/**
 * 获取 NPM 用户
 * @param options 可选配置项
 */
export async function getNpmUser(options?: RunCommandOptions): Promise<string> {
  return run('npm', ['whoami'], options).then(data => {
    return data.stdout.trim()
  })
}

/**
 * NPM 包信息
 * https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md
 */
export interface NpmInfo extends OmitIndexSignature<PackageJson> {
  version: string
  name: string
  dist: {
    shasum: string
    size: number
    tarball: string
  }
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'dist-tags': {
    latest: string
    alpha: string
    beta: string
    next: string
    [key: string]: string
  }
  versions: {
    [version: string]: Omit<NpmInfo, 'versions' | 'dist-tags'>
  }
}

/**
 * 获取 NPM 包元信息
 * @param name NPM 包名
 * @param options.registry 仓库地址
 * @param options.cwd 工作目录
 */
export async function getNpmMeta(
  name: string,
  options?: {
    cwd?: string
    registry?: string
  },
): Promise<Omit<NpmInfo, 'version'> | null>
/**
 * 获取指定版本的 NPM 包元信息
 * @param name NPM 包名
 * @param options.version 版本
 * @param options.registry 仓库地址
 * @param options.cwd 工作目录
 */
export async function getNpmMeta(
  name: string,
  options: {
    version: string
    cwd?: string
    registry?: string
  },
): Promise<Omit<NpmInfo, 'versions' | 'dist-tags'> | null>
export async function getNpmMeta(
  name: string,
  options?: {
    cwd?: string
    version?: string
    registry?: string
  },
): Promise<NpmInfo | null> {
  let registry = options?.registry

  if (!registry) {
    registry = await getNpmRegistry({
      cwd: options?.cwd,
    })
  }

  let url = `${registry.replace(/\/+$/, '')}/${encodeURIComponent(name).replace(
    /^%40/,
    '@',
  )}`

  if (options?.version) {
    url += `/${options.version}`
  }

  return urllib
    .request(url, { timeout: 30000, dataType: 'json' })
    .then(({ data }) => {
      if (!data || isString(data) || data.error || data.code) {
        return null
      }
      return data
    })
    .catch(() => {
      return null
    })
}

/**
 * 获取 NPM 包标签
 * @param name NPM 包名
 * @param options.cwd 工作目录
 * @param options.registry 仓库地址
 */
export async function getNpmDistTag(
  name: string,
  options?: {
    cwd?: string
    registry?: string
    timeout?: number
  },
): Promise<NpmInfo['dist-tags']> {
  const { cwd, registry, timeout } = options || {}
  const args = ['dist-tag', 'ls', name]

  if (registry) {
    args.push('--registry', registry)
  }

  if (timeout) {
    return timeoutWrapper(get(), timeout)
  }

  return get()

  async function get() {
    return run('npm', args, {
      cwd,
    }).then(data => {
      const distTag = {
        latest: '',
        beta: '',
        alpha: '',
        next: '',
      }
      data.stdout.split(os.EOL).forEach(item => {
        const paris = item.split(': ')
        distTag[paris[0] as keyof typeof distTag] = paris[1]
      })

      return distTag
    })
  }
}

/**
 * 获取 NPM 前缀
 */
export async function getNpmPrefix(): Promise<string> {
  if (process.env.GLOBAL_PREFIX) {
    return process.env.GLOBAL_PREFIX
  } else {
    let prefix = 'usr/local'

    if (process.platform === PLATFORM.WIN) {
      try {
        prefix = (await run('npm', ['prefix', '-g'])).stdout.toString().trim()
      } catch (err) {
        // ignore
      }
    } else {
      try {
        prefix = path.join(await which('node'), '../../')
      } catch (err) {
        // ignore
      }
    }

    process.env.GLOBAL_PREFIX = prefix
    return prefix
  }
}

/**
 * 解析后的 NPM 包名
 */
export interface ResolvedPkgName {
  /**
   * 包名
   */
  name: string
  /**
   * 版本号
   */
  version: string
  /**
   * 命名空间
   */
  scope: string
  /**
   * 剔除命名空间后的包名
   */
  unscopedName: string
}

/**
 * 解析 NPM 包名
 * @param name NPM 包名
 * @returns NPM 包信息
 * @example
 * '@eljs/utils@1.0.0' => { name: '@eljs/utils', version: '1.0.0', scope: '@eljs', unscopedName: 'utils'  }
 * 'utils@1.0.0' => { name: 'utils', version: '1.0.0, scope: '', unscopedName: 'utils'  }
 * '@eljs/utils' => { name: '@eljs/utils', version: 'latest', scope: '@eljs', unscopedName: 'utils'  }
 * 'utils' => { name: 'utils', version: 'latest', scope: '', unscopedName: 'utils'  }
 */
export function pkgNameAnalysis(name: string): ResolvedPkgName {
  try {
    const regex = /^(@?[^@]+)(?:@(.+))?$/
    const [, pkgName = name, pkgVersion = 'latest'] = name.match(regex) || []
    const pairs = pkgName.split('/')
    return {
      name: pkgName,
      version: pkgVersion,
      scope: pairs.length > 1 ? pairs[0] : '',
      unscopedName: pairs[pairs.length],
    }
  } catch (error) {
    return {
      name,
      version: 'latest',
      scope: '',
      unscopedName: name,
    }
  }
}
