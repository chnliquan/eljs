import type { Api } from '@/types'
import { syncCnpm } from '@/utils'
import { chalk, getNpmUser, logger, run } from '@eljs/utils'

export default (api: Api) => {
  api.onCheck(async () => {
    if (api.config.npm.skipCheck) {
      return
    }

    api.step('Checking npm ...')

    const user = await getNpmUser(api.cwd)

    for (const pkgName of api.appData.validPkgNames) {
      try {
        const owners = (
          await run('npm', ['owner', 'ls', pkgName], {
            cwd: api.cwd,
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
  })

  api.onRelease(async ({ version, prereleaseId }) => {
    const { registry, validPkgNames, validPkgRootPaths, packageManager } =
      api.appData

    api.step('Publishing package ...')

    const promiseArr = []
    const errors: string[] = []

    for (let i = 0; i < validPkgRootPaths.length; i++) {
      const pkgRootPath = validPkgRootPaths[i]
      const pkgName = validPkgNames[i]

      try {
        promiseArr.push(
          publishPackage(
            pkgRootPath,
            pkgName,
            version,
            registry,
            prereleaseId as string,
          ),
        )
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
      registry: string,
      distTag?: string,
    ) {
      const tag = distTag ? ['--tag', distTag] : []

      const cliArgs = [
        'publish',
        '--registry',
        registry,
        ...tag,
        '--access',
        'public',
      ].filter(Boolean)

      await run(packageManager, cliArgs, {
        cwd: pkgRootPath,
        verbose: true,
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
