import type { Api } from '@/types'
import { AppError } from '@/utils'
import { chalk, getNpmUser, logger, normalizeArgs, run } from '@eljs/utils'
import { EOL } from 'node:os'

export default (api: Api) => {
  api.onCheck(async () => {
    const { requireOwner } = api.config.npm

    if (requireOwner) {
      api.step('Checking npm owner ...')

      const user = await getNpmUser({
        cwd: api.cwd,
      })

      for (const pkgName of api.appData.validPkgNames) {
        try {
          const owners = (
            await run('npm', ['owner', 'ls', pkgName], {
              cwd: api.cwd,
            })
          ).stdout
            .trim()
            .split(EOL)
            .map(line => line.split(' ')?.[0])

          if (!owners?.includes(user)) {
            throw new AppError(
              `User ${chalk.cyan(user)} is not the owner of \`${pkgName}\`.`,
            )
          }
        } catch (error) {
          const err = error as Error

          if (err.message.indexOf('Not Found') > -1) {
            continue
          }

          throw err
        }
      }
    }
  })

  api.onRelease(async ({ version, prereleaseId }) => {
    const {
      registry,
      branch,
      validPkgNames,
      validPkgRootPaths,
      packageManager,
    } = api.appData

    api.step('Publishing package ...')

    const promiseArr = []
    const errors: string[] = []

    for (let i = 0; i < validPkgRootPaths.length; i++) {
      const pkgRootPath = validPkgRootPaths[i]
      const pkgName = validPkgNames[i]

      try {
        promiseArr.push(publishPackage(pkgRootPath, pkgName, version))
      } catch (error) {
        errors.push(pkgName)
      }
    }

    const settledResults = await Promise.allSettled(promiseArr)

    for (let i = 0; i < settledResults.length; i++) {
      const settledResult = settledResults[i]
      if (settledResult.status === 'rejected') {
        console.log()
        logger.error(
          `Published ${chalk.cyan(`${validPkgNames[i]}@${version}`)} failed.`,
        )

        const errorMessage =
          settledResult.reason?.message ?? settledResult.reason
        console.log(`Error: ${errorMessage}`)
      }
    }

    async function publishPackage(
      pkgRootPath: string,
      pkgName: string,
      version: string,
    ) {
      const tagArg = prereleaseId ? ['--tag', prereleaseId] : ''
      const registryArg = registry ? ['--registry', registry] : ''
      const { requireBranch } = api.config.git
      const gitCheckArg = requireBranch
        ? ['--publish-branch', requireBranch]
        : ['master', 'main'].includes(branch)
          ? []
          : ['--no-git-checks']

      const cliArgs = [
        'publish',
        ...tagArg,
        ...registryArg,
        ...gitCheckArg,
        ...normalizeArgs(api.config.npm.publishArgs),
      ].filter(Boolean)

      await run(packageManager, cliArgs, {
        cwd: pkgRootPath,
        verbose: true,
        stdin: 'inherit',
      })

      logger.ready(
        `Published ${chalk.bold.cyan(`${pkgName}@${version}`)} successfully.`,
      )
    }
  })
}
