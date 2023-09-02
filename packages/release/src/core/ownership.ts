import { logger, run } from '@eljs/utils'
import { step } from '../utils'

export async function ownershipCheck(publishPkgNames: string[]) {
  step('Checking npm ownership ...')

  const whoami = (await run('npm whoami')).stdout.trim()

  for (const pkgName of publishPkgNames) {
    try {
      const owners = (
        await run(`npm owner ls ${pkgName}`, {
          verbose: false,
        })
      ).stdout
        .trim()
        .split('\n')
        .map(line => line.split(' ')[0])

      if (!owners.includes(whoami)) {
        logger.printErrorAndExit(`${pkgName} is not owned by ${whoami}.`)
      }
    } catch (err) {
      if ((err as Error).message.indexOf('Not Found') > -1) {
        continue
      }

      logger.error(`${pkgName} ownership is invalid.`)
      throw new Error((err as Error).message)
    }
  }
}
