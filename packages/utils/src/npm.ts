import { execSync } from 'child_process'
import { sync } from 'cross-spawn'
import download from 'download'
import path from 'path'
import urllib from 'urllib'
import which from 'which'

import { PLATFORM } from './const'
import { existsSync, tmpdir } from './file'
import { logger } from './logger'
import { isString } from './type'
import { NpmClient, PkgJSON } from './types'

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
  const npm = sync(npmClient, [npmClient === 'yarn' ? '' : 'install'], {
    stdio: 'inherit',
    cwd,
  })

  if (npm.error) {
    throw npm.error
  }
}

export interface NpmInfo extends PkgJSON {
  version: string
  name: string
  dist: {
    shasum: string
    size: number
    tarball: string
  }
}

export function getNpmInfo(
  name: string,
  opts?: {
    registry?: string
    version?: string
  },
): Promise<NpmInfo | null> {
  const { registry = 'https://registry.npmjs.org', version = 'latest' } =
    opts || {}
  const url = `${registry.replace(/\/+$/, '')}/${encodeURIComponent(
    name,
  ).replace(/^%40/, '@')}/${version}`

  return urllib
    .request(url, { timeout: 30000, dataType: 'json' })
    .then(({ data }) => {
      if (isString(data) || data.error) {
        return null
      }

      if (version === 'latest') {
        return data.latest || data
      } else {
        return data?.versions?.[version] || data
      }
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
