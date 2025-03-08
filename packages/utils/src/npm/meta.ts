import { execSync } from 'child_process'
import execa from 'execa'
import os from 'os'
import path from 'path'
import urllib from 'urllib'
import which from 'which'

import { PLATFORM } from '../constants'
import { isString } from '../type'
import type { OmitIndexSignature, PkgJSON } from '../types'

/**
 * 获取 NPM 仓库
 * @param cwd 工作目录
 */
export async function getNpmRegistry(cwd = process.cwd()): Promise<string> {
  return execa('npm', ['config', 'get', 'registry'], {
    cwd,
  }).then(data => {
    return data.stdout.trim()
  })
}

/**
 * 获取 NPM 用户
 * @param cwd 工作目录
 */
export async function getNpmUser(cwd = process.cwd()): Promise<string> {
  return execa('npm', ['whoami'], {
    cwd,
  }).then(data => {
    return data.stdout.trim()
  })
}

/**
 * NPM 包信息
 * https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md
 */
export interface NpmInfo extends OmitIndexSignature<PkgJSON> {
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
 * 获取 NPM 包信息
 * @param name NPM 包名
 * @param options.registry 仓库地址
 * @param options.cwd 工作目录
 */
export async function getNpmInfo(
  name: string,
  options?: {
    registry?: string
    cwd?: string
  },
): Promise<Omit<NpmInfo, 'version'> | null>
/**
 * 获取指定版本的 NPM 包信息
 * @param name NPM 包名
 * @param options.version 版本
 * @param options.registry 仓库地址
 * @param options.cwd 工作目录
 */
export async function getNpmInfo(
  name: string,
  options: {
    version: string
    registry?: string
    cwd?: string
  },
): Promise<Omit<NpmInfo, 'versions' | 'dist-tags'> | null>
export async function getNpmInfo(
  name: string,
  options?: {
    version?: string
    registry?: string
    cwd?: string
  },
): Promise<NpmInfo | null> {
  const registry = options?.registry || (await getNpmRegistry(options?.cwd))
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
  },
): Promise<NpmInfo['dist-tags']> {
  const args = ['dist-tag', 'ls', name]

  if (options?.registry) {
    args.push('--registry', options.registry)
  }

  return execa('npm', args, {
    cwd: options?.cwd,
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

/**
 * 获取 NPM 前缀
 */
export function getNpmPrefix(): string {
  if (process.env.GLOBAL_PREFIX) {
    return process.env.GLOBAL_PREFIX
  } else {
    let prefix = 'usr/local'

    if (process.platform === PLATFORM.WIN) {
      try {
        prefix = execSync('npm prefix -g').toString().trim()
      } catch (err) {
        // ignore
      }
    } else {
      try {
        prefix = path.join(which.sync('node'), '../../')
      } catch (err) {
        // ignore
      }
    }

    process.env.GLOBAL_PREFIX = prefix
    return prefix
  }
}

/**
 * NPM 包名信息
 */
export interface PkgNameInfo {
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
export function pkgNameAnalysis(name: string): PkgNameInfo {
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
