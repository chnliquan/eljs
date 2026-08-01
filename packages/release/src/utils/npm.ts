import { chalk, getNpmPackage, logger, run } from '@eljs/utils'
import resolveBin from 'resolve-bin'
import semver from 'semver'

import { mapWithConcurrency } from '../internal/concurrency'

/**
 * 远程 dist tag
 */
export interface RemoteDistTag {
  /** 稳定版本的最高远程版本 */
  latest: string | undefined
  /** alpha 渠道的最高远程版本 */
  alpha: string | undefined
  /** beta 渠道的最高远程版本 */
  beta: string | undefined
  /** rc 渠道的最高远程版本 */
  rc: string | undefined
  /** 自定义 dist-tag 对应的最高远程版本 */
  [tag: string]: string | undefined
}

/**
 * 获取远程 dist tag
 * @param pkgNames - 包名
 * @param options - Npm 查询选项
 * @param tags - 需要汇总的 dist tag
 * @param concurrency - registry 查询并发上限
 * @returns 所有包在各 dist tag 下的最高版本
 */
export async function getRemoteDistTag(
  pkgNames: string[],
  options?: {
    cwd?: string
    registry?: string
  },
  tags: readonly string[] = ['latest', 'alpha', 'beta', 'rc'],
  concurrency = 8,
): Promise<RemoteDistTag> {
  const requestedTags = [...new Set(['latest', 'alpha', 'beta', 'rc', ...tags])]
  const npmMetadata = await mapWithConcurrency(pkgNames, concurrency, pkgName =>
    getNpmPackage(pkgName, options),
  )
  const distTagSets = npmMetadata
    .map(metadata => metadata?.['dist-tags'])
    .filter(distTags => Boolean(distTags))
  const result: RemoteDistTag = {
    latest: undefined,
    alpha: undefined,
    beta: undefined,
    rc: undefined,
  }

  if (!distTagSets.length) {
    return result
  }

  for (const tag of requestedTags) {
    const versions = distTagSets
      .map(distTags => distTags?.[tag])
      .filter((version): version is string => Boolean(version))

    result[tag] = versions.reduce<string | undefined>((highest, version) => {
      if (!semver.valid(version)) {
        logger.warn(
          `Ignored invalid remote version ${chalk.cyan(version)} for dist tag ${chalk.cyan(tag)}.`,
        )
        return highest
      }

      return !highest || semver.gt(version, highest) ? version : highest
    }, undefined)
  }

  return result
}

/**
 * 同步 Cnpm
 *
 * @param pkgNames - 包名
 * @returns 每个包同步任务的完成状态
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
