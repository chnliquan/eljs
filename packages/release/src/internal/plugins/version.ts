import {
  chalk,
  confirm,
  createDebugger,
  logger,
  pascalCase,
  prompts,
} from '@eljs/utils'
import { EOL } from 'node:os'
import semver, { RELEASE_TYPES, type ReleaseType } from 'semver'

import { prereleaseTypes } from '../../constants'
import type { Api, PrereleaseId } from '../../types'
import {
  AppError,
  getCanaryVersion,
  getMaxVersion,
  getReleaseVersion,
  getRemoteDistTag,
  isCanaryVersion,
  isVersionExist,
  isVersionValid,
  onCancel,
  updatePackageLock,
  updatePackageVersion,
} from '../../utils'

const debug = createDebugger('release:version')

export default (api: Api) => {
  api.onCheck(async ({ releaseTypeOrVersion }) => {
    if (releaseTypeOrVersion && !isVersionValid(releaseTypeOrVersion, true)) {
      throw new AppError(
        `Invalid semantic version ${chalk.cyan(releaseTypeOrVersion)}.`,
      )
    }
  })

  api.getIncrementVersion(
    async ({ releaseTypeOrVersion }) => {
      const version = await getIncrementVersion(api, releaseTypeOrVersion)

      if (!api.config.npm.confirm) {
        return version
      }

      return confirmVersion(api, version)
    },
    {
      stage: 10,
    },
  )

  api.onBeforeBumpVersion(
    async ({ version, isPrerelease, prereleaseId: preid }) => {
      const { prerelease, prereleaseId } = api.config.npm

      if (prereleaseId && prereleaseId !== preid) {
        throw new AppError(
          `Expected a ${prereleaseId} tag, but got ${chalk.cyan(version)}.`,
        )
      }

      if ((prereleaseId || prerelease === true) && !isPrerelease) {
        throw new AppError(
          `Expected a prerelease type, but got ${chalk.cyan(version)}.`,
        )
      }

      if (!prereleaseId && prerelease === false && isPrerelease) {
        throw new AppError(
          `Expected a release type, but got ${chalk.cyan(version)}.`,
        )
      }

      await checkVersion(
        api.appData.validPkgNames[0],
        version,
        api.appData.registry,
      )
    },
  )

  api.onBumpVersion(async ({ version }) => {
    const { projectPkgJsonPath, projectPkg, pkgNames, pkgJsonPaths, pkgs } =
      api.appData

    debug?.(pkgNames)
    // update all packages
    for (let i = 0; i < pkgNames.length; i++) {
      await updatePackageVersion(pkgJsonPaths[i], pkgs[i], version, pkgNames)
    }

    // update polyrepo project root package.json
    if (pkgJsonPaths[0] !== projectPkgJsonPath) {
      await updatePackageVersion(projectPkgJsonPath, projectPkg, version)
    }
  })

  api.onAfterBumpVersion(async ({ version }) => {
    if (isCanaryVersion(version)) {
      return
    }

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
  const { prerelease, prereleaseId, canary } = api.config.npm
  const { registry, projectPkg, validPkgNames } = api.appData

  api.step('Incrementing version ...')

  if (
    releaseTypeOrVersion &&
    !RELEASE_TYPES.includes(releaseTypeOrVersion as ReleaseType)
  ) {
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
      getReferenceVersion(prereleaseId),
      releaseTypeOrVersion as ReleaseType,
      prereleaseId,
    )
  }

  if (canary) {
    return getCanaryVersion(referenceVersionMap.latest, api.cwd)
  } else {
    logger.info(`Local version: ${chalk.cyan(localVersion)}`)

    if (remoteLatestVersion) {
      logger.info(`Remote latest version: ${chalk.cyan(remoteLatestVersion)}`)
    }

    if (remoteAlphaVersion && (!prereleaseId || prereleaseId === 'alpha')) {
      logger.info(`Remote alpha version: ${chalk.cyan(remoteAlphaVersion)}`)
    }

    if (remoteBetaVersion && (!prereleaseId || prereleaseId === 'beta')) {
      logger.info(`Remote beta version: ${chalk.cyan(remoteBetaVersion)}`)
    }

    if (remoteRcVersion && (!prereleaseId || prereleaseId === 'rc')) {
      logger.info(`Remote rc version: ${chalk.cyan(remoteRcVersion)}`)
    }
  }

  console.log()

  const patchVersion = getReleaseVersion(referenceVersionMap.latest, 'patch')
  const minorVersion = getReleaseVersion(referenceVersionMap.latest, 'minor')
  const majorVersion = getReleaseVersion(referenceVersionMap.latest, 'major')

  let answer: prompts.Answers<'value'> = {
    value: '',
  }

  if (prereleaseId) {
    answer = await prompts(
      getPrereleaseChoices(getReferenceVersion(prereleaseId), prereleaseId),
      {
        onCancel,
      },
    )
    return answer.value
  }

  const choices = getReleaseChoices(
    patchVersion,
    minorVersion,
    majorVersion,
    prerelease,
  )

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
        message: 'Please input the custom version:',
      })
      return answer.value
    }

    if (!['alpha', 'beta', 'rc'].includes(releaseType)) {
      return answer.value
    }
  }

  answer = await prompts(
    getPrereleaseChoices(getReferenceVersion(answer.value), answer.value),
    {
      onCancel,
    },
  )

  return answer.value

  function getReferenceVersion(prereleaseId: PrereleaseId) {
    return referenceVersionMap[prereleaseId] || referenceVersionMap.latest
  }
}

function getPrereleaseChoices(
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
        } (${chalk.cyan(version)})`,
        value: version,
      }
    }),
  }
}

function getReleaseChoices(
  patchVersion: string,
  minorVersion: string,
  majorVersion: string,
  prerelease?: boolean,
) {
  let choices = [
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
  ]

  if (prerelease === true) {
    choices = choices.slice(3)
  }

  if (prerelease === false) {
    choices = choices.slice(0, 3)
  }

  return choices.concat({
    title: `Custom`,
    value: 'custom',
    description: chalk.grey(`Custom version`),
  })
}

async function checkVersion(
  pkgName: string,
  version: string,
  registry?: string,
) {
  if (!semver.valid(version)) {
    throw new AppError(`Invalid semantic version ${chalk.cyan(version)}.`)
  }

  if (await isVersionExist(pkgName, version, registry)) {
    throw new AppError(
      `Package ${chalk.cyan(`${pkgName}@${version}`)} has been published already.`,
    )
  }
}

async function confirmVersion(api: Api, version: string): Promise<string> {
  const { validPkgNames } = api.appData

  if (!validPkgNames.length) {
    return version
  }

  let confirmMessage = ''

  if (validPkgNames.length === 1) {
    confirmMessage = `Are you sure to bump version to ${chalk.cyan(version)}`
  } else {
    console.log(`The packages will be bumped are as follows:${EOL}`)

    for (const pkgName of validPkgNames) {
      console.log(` - ${chalk.cyan(`${pkgName}@${version}`)}`)
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
