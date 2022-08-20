import { execSync } from 'child_process'
import { sync } from 'cross-spawn'
import path from 'path'
import urllib from 'urllib'
import which from 'which'

import { PLATFORM } from './const'
import { existsSync } from './file'
import { NpmClient, PkgJson } from './types'

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

export interface NpmInfo extends PkgJson {
  version: string
  name: string
  dist: {
    shasum: string
    size: number
    tarball: string
  }
}

export function getNpmInfo(
  pkgName: string,
  baseUrl = 'https://registry.npmjs.org',
  version = 'latest',
): Promise<NpmInfo | null> {
  const url = `${baseUrl}/${pkgName}/${version}`

  return urllib
    .request(url, { timeout: 30000, dataType: 'json' })
    .then(({ data }) => {
      if (version === 'latest') {
        return data.latest || data
      } else {
        return data?.versions?.[version] || data
      }
    })
}
