import { PLATFORM } from '@/constants'
import { run, type RunCommandOptions } from '@/cp'
import { isString } from '@/type'
import type { OmitIndexSignature, PackageJson } from '@/types'
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
 * NPM 包
 * @link https://github.com/npm/registry/blob/main/docs/REGISTRY-API.md#package
 */
export interface NpmPackage extends OmitIndexSignature<PackageJson> {
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
    [version: string]: Omit<NpmPackage, 'versions' | 'dist-tags'>
  }
}

/**
 * 获取 NPM 包
 * @param name NPM 包名
 * @param options.cwd 当前工作目录
 * @param options.registry 仓库地址
 * @param options.timeout 超时时间
 */
export async function getNpmPackage(
  name: string,
  options?: {
    cwd?: string
    registry?: string
    timeout?: number
  },
): Promise<Omit<NpmPackage, 'version'> | null>
/**
 * 获取指定版本的 NPM 包元信息
 * @param name NPM 包名
 * @param options.version 版本
 * @param options.cwd 工作目录
 * @param options.registry 仓库地址
 * @param options.timeout 超时时间
 */
export async function getNpmPackage(
  name: string,
  options: {
    version: string
    cwd?: string
    registry?: string
    timeout?: number
  },
): Promise<Omit<NpmPackage, 'versions' | 'dist-tags'> | null>
export async function getNpmPackage(
  name: string,
  options?: {
    cwd?: string
    version?: string
    registry?: string
    timeout?: number
  },
): Promise<NpmPackage | null> {
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
    .request(url, { timeout: options?.timeout ?? 10000, dataType: 'json' })
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
