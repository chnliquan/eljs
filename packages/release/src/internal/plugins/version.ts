import {
  chalk,
  confirm,
  createDebugger,
  logger,
  pascalCase,
  prompts,
} from '@eljs/utils'
import { EOL } from 'node:os'
import semver, { type ReleaseType } from 'semver'

import { prereleaseTypes } from '../../constants'
import { definePlugin } from '../../define'
import type { PrereleaseId, ReleasePluginContext } from '../../types'
import {
  AppError,
  getCanaryVersion,
  getMaxVersion,
  getReleaseVersion,
  getRemoteDistTag,
  isCanaryVersion,
  isGitTagAtHead,
  isVersionExist,
  isVersionValid,
  onCancel,
  updatePackageLock,
} from '../../utils'
import { mapWithConcurrency } from '../concurrency'
import {
  captureLockfiles,
  restoreLockfiles,
  type LockfileSnapshot,
} from '../lockfile-transaction'
import {
  prepareVersionPlan,
  rollbackVersionPlan,
  writeVersionPlan,
  type PreparedVersionPlan,
} from '../version-plan'

const { RELEASE_TYPES } = semver

const debug = createDebugger('release:version')

export default definePlugin(context => {
  let preparedVersionPlan: PreparedVersionPlan | undefined

  context.onCheck(async ({ releaseTypeOrVersion }) => {
    if (releaseTypeOrVersion && !isVersionValid(releaseTypeOrVersion, true)) {
      throw new AppError(
        `Invalid semantic version ${chalk.cyan(releaseTypeOrVersion)}.`,
      )
    }
  })

  context.getIncrementVersion(
    async ({ releaseTypeOrVersion }) => {
      const version = await getIncrementVersion(context, releaseTypeOrVersion)

      if (!context.config.npm.confirm) {
        return version
      }

      return confirmVersion(context, version)
    },
    {
      stage: 10,
    },
  )

  context.onBeforeBumpVersion(
    async ({ version, isPrerelease, prereleaseId: preid }) => {
      const { prerelease, prereleaseId } = context.config.npm

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

      const existingPkgNames: string[] = []
      const versionChecks = await mapWithConcurrency(
        context.appData.validPkgNames,
        context.config.npm.networkConcurrency,
        async pkgName => ({
          exists: await checkVersion(
            pkgName,
            version,
            context.appData.registry,
            context.cwd,
          ),
          pkgName,
        }),
      )
      const releaseTagNames = context.config.git.independent
        ? context.appData.validPkgNames.map(pkgName => `${pkgName}@${version}`)
        : [`v${version}`]
      const workspaceVersions = new Map(
        context.appData.pkgNames.map((pkgName, index) => [
          pkgName,
          context.appData.pkgs[index]?.version,
        ]),
      )
      const shouldCheckReleaseTags =
        versionChecks.some(({ exists }) => exists) ||
        context.appData.validPkgNames.every(
          pkgName => workspaceVersions.get(pkgName) === version,
        )
      const tagChecks = new Map(
        shouldCheckReleaseTags
          ? await Promise.all(
              releaseTagNames.map(
                async tagName =>
                  [
                    tagName,
                    await isGitTagAtHead(tagName, {
                      cwd: context.cwd,
                      verbose: false,
                    }),
                  ] as const,
              ),
            )
          : [],
      )
      const isReleaseRetry =
        shouldCheckReleaseTags &&
        releaseTagNames.every(tagName => tagChecks.get(tagName) === true)

      for (const { exists, pkgName } of versionChecks) {
        if (!exists) {
          continue
        }

        const tagName = context.config.git.independent
          ? `${pkgName}@${version}`
          : `v${version}`
        const isRetry = tagChecks.get(tagName) === true

        if (!isRetry) {
          throw new AppError(
            `Package ${chalk.cyan(`${pkgName}@${version}`)} has been published already.`,
          )
        }

        existingPkgNames.push(pkgName)
      }

      context.appData.existingPkgNames = existingPkgNames
      context.appData.isReleaseRetry = isReleaseRetry

      if (existingPkgNames.length) {
        logger.warn(
          `Retrying release; already published packages will be skipped: ${existingPkgNames
            .map(pkgName => chalk.cyan(`${pkgName}@${version}`))
            .join(', ')}.`,
        )
      } else if (isReleaseRetry) {
        logger.warn(
          'Retrying release from the existing local release commit and tags.',
        )
      }

      preparedVersionPlan = await prepareVersionPlan(context.appData, version)
      context.appData.pkgs = preparedVersionPlan.pkgs
      context.appData.projectPkg = preparedVersionPlan.projectPkg
    },
  )

  context.onBumpVersion(async ({ version }) => {
    const plan =
      preparedVersionPlan?.version === version
        ? preparedVersionPlan
        : await prepareVersionPlan(context.appData, version)
    preparedVersionPlan = plan
    context.appData.pkgs = plan.pkgs
    context.appData.projectPkg = plan.projectPkg
    debug?.(context.appData.pkgNames)

    if (!context.config.dryRun) {
      await writeVersionPlan(plan)
    }
  })

  context.onAfterBumpVersion(async ({ version }) => {
    if (isCanaryVersion(version) || context.config.dryRun) {
      return
    }

    context.step('Updating Lockfile ...')
    let lockfileSnapshot: LockfileSnapshot | undefined

    try {
      lockfileSnapshot = await captureLockfiles(context.cwd)
      await updatePackageLock(
        context.appData.packageManager,
        {
          cwd: context.cwd,
          verbose: true,
        },
        context.appData.packageManagerVariant,
      )
    } catch (lockfileError) {
      const rollbackErrors: unknown[] = []

      if (lockfileSnapshot) {
        try {
          await restoreLockfiles(lockfileSnapshot)
        } catch (error) {
          rollbackErrors.push(error)
        }
      }

      if (preparedVersionPlan?.version === version) {
        try {
          await rollbackVersionPlan(preparedVersionPlan)
        } catch (error) {
          rollbackErrors.push(error)
        }

        context.appData.pkgs = preparedVersionPlan.originalPkgs
        context.appData.projectPkg = preparedVersionPlan.originalProjectPkg
      }

      if (rollbackErrors.length) {
        throw new AggregateError(
          [lockfileError, ...rollbackErrors],
          'Lockfile update failed and the version transaction could not be fully restored.',
          { cause: lockfileError },
        )
      }

      throw lockfileError
    }
  })
})

async function getIncrementVersion(
  context: ReleasePluginContext,
  releaseTypeOrVersion?: string,
): Promise<string> {
  const { prerelease, prereleaseId, canary } = context.config.npm
  const { registry, projectPkg, validPkgNames, pkgs } = context.appData

  context.step('Incrementing version ...')

  if (
    releaseTypeOrVersion &&
    !RELEASE_TYPES.includes(releaseTypeOrVersion as ReleaseType)
  ) {
    return releaseTypeOrVersion
  }

  const localVersion = getMaxVersion(
    projectPkg.version,
    ...pkgs
      .map(pkg => pkg.version)
      .filter((version): version is string => Boolean(version)),
  )
  const remoteQueryOptions = {
    cwd: context.cwd,
    registry,
  }
  const remoteDistTags =
    prereleaseId && !['alpha', 'beta', 'rc'].includes(prereleaseId)
      ? await getRemoteDistTag(
          validPkgNames,
          remoteQueryOptions,
          ['latest', 'alpha', 'beta', 'rc', prereleaseId],
          context.config.npm.networkConcurrency,
        )
      : await getRemoteDistTag(
          validPkgNames,
          remoteQueryOptions,
          undefined,
          context.config.npm.networkConcurrency,
        )
  const remoteLatestVersion = remoteDistTags.latest
  const remoteAlphaVersion = remoteDistTags.alpha
  const remoteBetaVersion = remoteDistTags.beta
  const remoteRcVersion = remoteDistTags.rc

  const referenceVersionMap: Record<string, string> = {
    latest: getMaxVersion(localVersion, remoteLatestVersion),
    alpha: getMaxVersion(localVersion, remoteLatestVersion, remoteAlphaVersion),
    beta: getMaxVersion(localVersion, remoteLatestVersion, remoteBetaVersion),
    rc: getMaxVersion(localVersion, remoteLatestVersion, remoteRcVersion),
  }

  if (prereleaseId && !referenceVersionMap[prereleaseId]) {
    referenceVersionMap[prereleaseId] = getMaxVersion(
      localVersion,
      remoteLatestVersion,
      remoteDistTags[prereleaseId],
    )
  }

  if (releaseTypeOrVersion) {
    return getReleaseVersion(
      getReferenceVersion(prereleaseId),
      releaseTypeOrVersion as ReleaseType,
      prereleaseId,
    )
  }

  if (canary) {
    return getCanaryVersion(referenceVersionMap.latest, context.cwd)
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

    const remotePrereleaseVersion = prereleaseId
      ? remoteDistTags[prereleaseId]
      : undefined

    if (
      prereleaseId &&
      !['alpha', 'beta', 'rc'].includes(prereleaseId) &&
      remotePrereleaseVersion
    ) {
      logger.info(
        `Remote ${prereleaseId} version: ${chalk.cyan(remotePrereleaseVersion)}`,
      )
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

    const releaseType = answer.value

    if (releaseType === 'canary') {
      return getCanaryVersion(referenceVersionMap.latest, context.cwd)
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

  function getReferenceVersion(prereleaseId?: PrereleaseId) {
    const knownVersion = prereleaseId
      ? referenceVersionMap[prereleaseId as keyof typeof referenceVersionMap]
      : undefined
    return knownVersion || referenceVersionMap.latest
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
  cwd?: string,
): Promise<boolean> {
  if (!semver.valid(version)) {
    throw new AppError(`Invalid semantic version ${chalk.cyan(version)}.`)
  }

  return isVersionExist(pkgName, version, registry, cwd)
}

async function confirmVersion(
  context: ReleasePluginContext,
  initialVersion: string,
): Promise<string> {
  const { validPkgNames } = context.appData

  if (!validPkgNames.length) {
    return initialVersion
  }

  let version = initialVersion

  while (true) {
    let confirmMessage: string

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
    }

    version = await getIncrementVersion(context)
  }
}
