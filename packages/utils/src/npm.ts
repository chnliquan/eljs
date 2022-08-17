import { execSync } from 'child_process'
import path from 'path'
import urllib from 'urllib'
import which from 'which'

import { PLATFORM } from './const'

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

export interface NpmInfo {
  version: string
  name: string
  main?: string
  repository?: {
    type: string
    url: string
  }
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  dist: {
    shasum: string
    size: number
    tarball: string
  }
  [propName: string]: unknown
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
