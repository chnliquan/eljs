import { sync } from 'cross-spawn'
import download from 'download'
import path from 'path'
import urllib from 'urllib'
import which from 'which'

import { execSync } from 'child_process'
import execa from 'execa'
import { PLATFORM } from './const'
import { existsSync, tmpdir } from './file'
import { logger } from './logger'
import { isString } from './type'
import { NpmClient, OmitIndexSignature, PkgJSON } from './types'

export function getNodePrefix(): string {
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

export function getNpmClient(cwd: string): NpmClient {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const chokidarPkg = require('chokidar/package.json')

  if (chokidarPkg.__npminstall_done) {
    return 'cnpm'
  }

  const chokidarPath = require.resolve('chokidar')

  if (
    chokidarPath.includes('.pnpm') ||
    existsSync(path.join(cwd, 'node_modules', '.pnpm'))
  ) {
    return 'pnpm'
  }

  if (
    existsSync(path.join(cwd, 'yarn.lock')) ||
    existsSync(path.join(cwd, 'node_modules', '.yarn-integrity'))
  ) {
    return 'yarn'
  }

  return 'npm'
}

export interface InstallWithNpmClientOpts {
  npmClient: NpmClient
  cwd: string
}

export function installWithNpmClient({
  npmClient,
  cwd,
}: InstallWithNpmClientOpts): void {
  const npm = sync(
    npmClient,
    [npmClient === 'yarn' || npmClient === 'pnpm' ? '' : 'install'],
    {
      stdio: 'inherit',
      cwd,
    },
  )

  if (npm.error) {
    throw npm.error
  }
}

// https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md
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
    latest?: string
    beta?: string
    alpha?: string
  }
  versions: {
    [version: string]: Omit<NpmInfo, 'versions' | 'dist-tags'>
  }
}

/**
 * 获取 NPM 包信息
 * @param name NPM 包名
 * @param opts.registry 仓库地址
 */
export function getNpmInfo(
  name: string,
  opts?: {
    registry?: string
  },
): Promise<Omit<NpmInfo, 'version'> | null>
/**
 * 获取指定版本的 NPM 包信息
 * @param name NPM 包名
 * @param opts.version 版本
 * @param opts.registry 仓库地址
 */
export function getNpmInfo(
  name: string,
  opts: {
    version: string
    registry?: string
  },
): Promise<Omit<NpmInfo, 'versions' | 'dist-tags'> | null>
export function getNpmInfo(
  name: string,
  opts?: {
    version?: string
    registry?: string
  },
): Promise<NpmInfo | null> {
  const registry =
    opts?.registry || execa.sync('npm', ['get', 'registry']).stdout
  let url = `${registry.replace(/\/+$/, '')}/${encodeURIComponent(name).replace(
    /^%40/,
    '@',
  )}`

  if (opts?.version) {
    url += `/${opts.version}`
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
 * 解析 NPM 包名
 * @param name NPM 包名
 * @returns NPM 包信息
 * @example
 * '@eljs/utils@1.0.0' => { name: '@eljs/utils', version: '1.0.0', scope: '@eljs', unscopedName: 'utils'  }
 * 'utils@1.0.0' => { name: 'utils', version: '1.0.0, scope: '', unscopedName: 'utils'  }
 * '@eljs/utils' => { name: '@eljs/utils', version: 'latest', scope: '@eljs', unscopedName: 'utils'  }
 * 'utils' => { name: 'utils', version: 'latest', scope: '', unscopedName: 'utils'  }
 */
export function pkgNameAnalysis(name = '') {
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

export async function downloadNpmRepo(
  url: string,
  dest = tmpdir(true),
  opts?: download.DownloadOptions,
): Promise<string> {
  try {
    await download(url, dest, {
      extract: true,
      strip: 1,
      headers: {
        accept: 'application/tgz',
      },
      ...opts,
    })
  } catch (err) {
    logger.printErrorAndExit(
      `Failed to download template repository ${url}，\n ${err}`,
    )
  }

  return dest
}
