import { getNpmUser, logger, run } from '@eljs/utils'
import { step } from '../utils'

export async function ownershipCheck(publishPkgNames: string[]) {
  step('Checking npm ownership ...')

  const user = await getNpmUser()

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

      if (!owners.includes(user)) {
        logger.printErrorAndExit(`${pkgName} is not owned by ${user}.`)
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
