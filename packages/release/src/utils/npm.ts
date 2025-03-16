import { chalk, getNpmDistTag, logger, run, timeout } from '@eljs/utils'
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
 * @param cwd 当前工作目录
 * @param pkgNames 包名
 * @param registry 仓库源
 */
export async function getRemoteDistTag(
  pkgNames: string[],
  options?: {
    cwd?: string
    registry?: string
  },
): Promise<RemoteDistTag> {
  try {
    const distTag = await timeout(
      (async () => {
        for (let i = 0; i < pkgNames.length; i++) {
          const pkgName = pkgNames[i]

          try {
            const distTag = await getNpmDistTag(pkgName, options)

            return {
              latest: distTag['latest'],
              alpha: distTag['alpha'],
              beta: distTag['beta'],
              rc: distTag['rc'],
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } catch (err: any) {
            if (err.message.includes('command not found')) {
              logger.error(
                `Please make sure the ${chalk.cyanBright.bold(
                  'npm',
                )} has been installed.`,
              )
              process.exit(1)
            } else {
              console.log()
            }
          }
        }

        return {
          latest: '',
          alpha: '',
          beta: '',
          rc: '',
        }
      })(),
      pkgNames.length * 2000,
    )
    return distTag
  } catch (err) {
    return {
      latest: '',
      alpha: '',
      beta: '',
      rc: '',
    }
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
    logger.done(`Sync ${chalk.cyanBright.bold(`${pkgName}`)} to cnpm.`)
  }

  return Promise.allSettled(promiseArr)
}
