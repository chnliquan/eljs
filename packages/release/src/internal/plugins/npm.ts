import type { Api } from '@/types'
import { syncCnpm } from '@/utils'
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
            .map(line => line.split(' ')[0])

          if (!owners.includes(user)) {
            logger.printErrorAndExit(`${pkgName} is not owned by ${user}.`)
          }
        } catch (error) {
          const err = error as Error

          if (err.message.indexOf('Not Found') > -1) {
            continue
          }

          logger.printErrorAndExit(`${pkgName} ownership is invalid.`)
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
          `Published ${chalk.cyanBright.bold(
            `${validPkgNames[i]}@${version}`,
          )} failed.`,
        )

        if (settledResult.reason?.message) {
          console.log(`Error: ${settledResult.reason.message}`)
        } else {
          console.log(settledResult.reason)
        }
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
        stdout: 'inherit',
        stdin: 'inherit',
      })

      logger.done(
        `Published ${chalk.cyanBright.bold(`${pkgName}@${version}`)} successfully.`,
      )
    }
  })

  api.onAfterRelease(async () => {
    if (api.config.npm.cnpm) {
      api.step('Sync packages to cnpm ...')
      await syncCnpm(api.appData.validPkgNames)
    }
  })
}
