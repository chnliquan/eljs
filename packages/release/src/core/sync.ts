import { chalk, logger, run } from '@eljs/utils'
import resolveBin from 'resolve-bin'

export async function sync(publishPkgNames: string[]) {
  const cnpm = resolveBin.sync('cnpm')

  const promiseArr = []
  for (const pkgName of publishPkgNames) {
    promiseArr.push(doSync(pkgName))
  }

  async function doSync(pkgName: string) {
    await run(cnpm, ['sync', pkgName], {
      verbose: false,
    })
    logger.done(`Sync ${chalk.cyanBright.bold(`${pkgName}`)} to cnpm.`)
  }

  return Promise.allSettled(promiseArr)
}
