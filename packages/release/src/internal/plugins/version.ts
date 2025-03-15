import { prereleaseTypes } from '@/constants'
import type { Api, PrereleaseId } from '@/types'
import {
  getCanaryVersion,
  getMaxVersion,
  getReleaseVersion,
  getRemoteDistTag,
  isVersionExist,
  isVersionValid,
  updatePackageLock,
  updatePackageVersion,
} from '@/utils'
import { chalk, confirm, logger, pascalCase, prompts } from '@eljs/utils'
import semver, { RELEASE_TYPES, type ReleaseType } from 'semver'

export default (api: Api) => {
  api.onCheck(async ({ releaseTypeOrVersion }) => {
    if (releaseTypeOrVersion && !isVersionValid(releaseTypeOrVersion, true)) {
      logger.printErrorAndExit(
        `Invalid semantic version ${chalk.bold(releaseTypeOrVersion)}.`,
      )
    }
  })

  api.getIncrementVersion(async ({ releaseTypeOrVersion }) => {
    const version = await getIncrementVersion(api, releaseTypeOrVersion)

    if (!api.config.npm.confirm) {
      return version
    }

    return confirmVersion(api, version)
  })

  api.onBeforeBumpVersion(async ({ version }) => {
    if (!api.config.npm.confirm) {
      return
    }
    await confirmVersion(api, version)
  })

  api.onBumpVersion(({ version }) => {
    const { projectPkgJsonPath, projectPkg, pkgNames, pkgJsonPaths, pkgs } =
      api.appData

    // update all packages
    pkgNames.forEach((_, index) => {
      updatePackageVersion(pkgJsonPaths[index], pkgs[index], version, pkgNames)
    })

    // update polyrepo project root package.json
    if (pkgJsonPaths[0] !== projectPkgJsonPath) {
      updatePackageVersion(projectPkgJsonPath, projectPkg, version)
    }
  })

  api.onAfterBumpVersion(async () => {
    api.step('Updating Lockfile ...')
    await updatePackageLock(api.appData.packageManager, {
      cwd: api.cwd,
      verbose: true,
    })
  })
}

async function getIncrementVersion(
  api: Api,
  releaseTypeOrVersion?: string,
): Promise<string> {
  const { prereleaseId, canary } = api.config.npm
  const { registry, projectPkg, validPkgNames } = api.appData

  api.step('Incrementing version ...')

  if (
    releaseTypeOrVersion &&
    !RELEASE_TYPES.includes(releaseTypeOrVersion as ReleaseType)
  ) {
    await checkVersion(releaseTypeOrVersion)
    return releaseTypeOrVersion
  }

  const localVersion = projectPkg.version
  const {
    latest: remoteLatestVersion,
    alpha: remoteAlphaVersion,
    beta: remoteBetaVersion,
    rc: remoteRcVersion,
  } = await getRemoteDistTag(validPkgNames, {
    cwd: api.cwd,
    registry,
  })

  const referenceVersionMap = {
    latest: getMaxVersion(localVersion, remoteLatestVersion),
    alpha: getMaxVersion(localVersion, remoteLatestVersion, remoteAlphaVersion),
    beta: getMaxVersion(localVersion, remoteLatestVersion, remoteBetaVersion),
    rc: getMaxVersion(localVersion, remoteLatestVersion, remoteRcVersion),
  }

  if (releaseTypeOrVersion) {
    return getReleaseVersion(
      prereleaseId
        ? referenceVersionMap[prereleaseId]
        : referenceVersionMap.latest,
      releaseTypeOrVersion as ReleaseType,
      prereleaseId,
    )
  }

  if (canary) {
    return getCanaryVersion(referenceVersionMap.latest, api.cwd)
  } else {
    logger.info(`- Local version: ${chalk.cyanBright.bold(localVersion)}`)

    if (remoteLatestVersion) {
      logger.info(
        `- Remote latest version: ${chalk.cyanBright.bold(
          remoteLatestVersion,
        )}`,
      )
    }

    if (remoteAlphaVersion && (!prereleaseId || prereleaseId === 'alpha')) {
      logger.info(
        `- Remote alpha version: ${chalk.cyanBright.bold(remoteAlphaVersion)}`,
      )
    }

    if (remoteBetaVersion && (!prereleaseId || prereleaseId === 'beta')) {
      logger.info(
        `- Remote beta version: ${chalk.cyanBright.bold(remoteBetaVersion)}`,
      )
    }

    if (remoteRcVersion && (!prereleaseId || prereleaseId === 'rc')) {
      logger.info(
        `- Remote rc version: ${chalk.cyanBright.bold(remoteRcVersion)}`,
      )
    }
  }

  console.log()

  const patchVersion = getReleaseVersion(referenceVersionMap.latest, 'patch')
  const minorVersion = getReleaseVersion(referenceVersionMap.latest, 'minor')
  const majorVersion = getReleaseVersion(referenceVersionMap.latest, 'major')

  const choices = [
    {
      title: `Patch (${patchVersion})`,
      value: patchVersion,
      description: chalk.grey(`Bug Fix`),
    },
    {
      title: `Minor (${minorVersion})`,
      value: minorVersion,
      description: chalk.grey(`New Feature`),
    },
    {
      title: `Major (${majorVersion})`,
      value: majorVersion,
      description: chalk.grey(`Breaking Change`),
    },
    {
      title: `Alpha`,
      value: 'alpha',
      description: chalk.grey(`Internal Test Version`),
    },
    {
      title: `Beta`,
      value: 'beta',
      description: chalk.grey(`External Test Version`),
    },
    {
      title: `Rc`,
      value: 'rc',
      description: chalk.grey(`Release Candidate Version`),
    },
    {
      title: `Canary`,
      value: 'canary',
      description: chalk.grey(`Canary Deployment Version`),
    },
    {
      title: `Custom`,
      value: 'custom',
      description: chalk.grey(`Custom version`),
    },
  ]

  let answer: prompts.Answers<'value'> = {
    value: '',
  }

  const onCancel = () => {
    process.exit(1)
  }

  let releaseType = ''

  if (!prereleaseId) {
    answer = await prompts(
      [
        {
          name: 'value',
          type: 'select',
          message: 'Please select the release type to bump:',
          choices,
        },
      ],
      {
        onCancel,
      },
    )

    releaseType = answer.value

    if (releaseType === 'canary') {
      return getCanaryVersion(referenceVersionMap.latest, api.cwd)
    }

    if (releaseType === 'custom') {
      answer = await prompts({
        name: 'value',
        type: 'text',
        message: 'Input custom version:',
        initial: projectPkg.version,
      })

      await checkVersion(answer.value)
      return answer.value
    }

    if (!['alpha', 'beta', 'rc'].includes(releaseType)) {
      return answer.value
    }
  }

  // prereleaseId version
  const referenceVersion = referenceVersionMap[answer.value as PrereleaseId]
  answer = await prompts(
    getPreVersionPromptQuestions(referenceVersion, releaseType as PrereleaseId),
    {
      onCancel,
    },
  )

  return answer.value

  async function checkVersion(version: string) {
    if (!semver.valid(version)) {
      logger.printErrorAndExit(
        `Invalid semantic version ${chalk.bold(version)}.`,
      )
    }

    const pkgName = validPkgNames[0]

    if (await isVersionExist(pkgName, version)) {
      logger.printErrorAndExit(
        `${pkgName} has published v${chalk.bold(version)} already.`,
      )
    }
  }

  function getPreVersionPromptQuestions(
    referenceVersion: string,
    prereleaseId: PrereleaseId,
  ): prompts.PromptObject {
    return {
      name: 'value',
      type: 'select',
      message: `Please select the ${prereleaseId} version to bump:`,
      choices: prereleaseTypes.map(releaseType => {
        const version = getReleaseVersion(
          referenceVersion,
          releaseType,
          prereleaseId,
        )
        return {
          title: `${
            releaseType === 'prerelease'
              ? pascalCase(releaseType)
              : pascalCase(releaseType) + '  '
          } (${version})`,
          value: version,
        }
      }),
    }
  }
}

async function confirmVersion(api: Api, version: string): Promise<string> {
  const { validPkgNames } = api.appData

  let confirmMessage = ''

  if (validPkgNames.length === 1) {
    confirmMessage = `Are you sure to bump the version to ${chalk.cyanBright(
      version,
    )}`
  } else {
    console.log(chalk.bold('The packages to be bumped are as follows: \n'))

    for (const pkgName of validPkgNames) {
      console.log(` - ${chalk.cyanBright(`${pkgName}@${version}`)}`)
    }

    console.log()
    confirmMessage = 'Are you sure to bump?'
  }

  const answer = await confirm(confirmMessage)
  console.log()

  if (answer) {
    return version
  } else {
    const version = await getIncrementVersion(api)
    return confirmVersion(api, version)
  }
}
