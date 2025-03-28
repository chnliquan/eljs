import { chalk, getNpmPackage, logger, run } from '@eljs/utils'
import resolveBin from 'resolve-bin'

/**
 * 远程 dist tag
 */
export interface RemoteDistTag {
  latest: string
  alpha: string
  beta: string
  rc: string
}

/**
 * 获取远程 dist tag
 * @param pkgNames 包名
 * @param options.cwd 当前工作目录
 * @param options.registry 仓库源
 */
export async function getRemoteDistTag(
  pkgNames: string[],
  options?: {
    cwd?: string
    registry?: string
  },
): Promise<RemoteDistTag> {
  for (let i = 0; i < pkgNames.length; i++) {
    const pkgName = pkgNames[i]
    const npmMeta = await getNpmPackage(pkgName, options)
    const distTags = npmMeta?.['dist-tags']

    if (!distTags) {
      continue
    }

    return {
      latest: distTags['latest'],
      alpha: distTags['alpha'],
      beta: distTags['beta'],
      rc: distTags['rc'],
    }
  }

  return {
    latest: '',
    alpha: '',
    beta: '',
    rc: '',
  }
}

/**
 * 同步 Cnpm
 * @param pkgNames 包名
 */
export async function syncCnpm(pkgNames: string[]) {
  const cnpm = resolveBin.sync('cnpm')

  const promiseArr = []
  for (const pkgName of pkgNames) {
    promiseArr.push(doSync(pkgName))
  }

  async function doSync(pkgName: string) {
    await run(cnpm, ['sync', pkgName])
    logger.ready(`Sync ${chalk.cyan(pkgName)} to cnpm.`)
  }

  return Promise.allSettled(promiseArr)
}
