import { confirm, prompts } from '@eljs/utils/cli'
import { chalk, createDebugger, logger } from '@eljs/utils/logger'
import { pascalCase } from '@eljs/utils/string'
import { EOL } from 'node:os'
import semver, { type ReleaseType } from 'semver'

import { prereleaseTypes } from '../../constants'
import { definePlugin } from '../../define'
import type { AppData, PrereleaseId, ReleasePluginContext } from '../../types'
import {
  AppError,
  findRetryVersionAtHead,
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
  captureFileSnapshots,
  captureLockfiles,
  restoreLockfiles,
  type LockfileSnapshot,
} from '../lockfile-transaction'
import {
  closeRollbackWindow,
  registerPrecommitRollback,
  rollbackPrecommitChanges,
} from '../precommit-rollback'
import {
  prepareVersionPlan,
  writeVersionPlan,
  type PreparedVersionPlan,
} from '../version-plan'

const { RELEASE_TYPES } = semver

const debug = createDebugger('release:version')

export default definePlugin(context => {
  let preparedVersionPlan: PreparedVersionPlan | undefined
  let manifestSnapshot: LockfileSnapshot | undefined
  let rollbackData: AppData | undefined

  context.onError(async () => {
    if (rollbackData) await rollbackPrecommitChanges(rollbackData)
  })
  context.onAfterRelease(() => closeRollbackWindow(context.appData))

  /** 本地写入失败时立即消费恢复回调，避免后续 onError 重复恢复 */
  async function restoreAfterFailure(error: unknown): Promise<never> {
    let rollbackFailure: unknown
    try {
      await rollbackPrecommitChanges(context.appData)
    } catch (rollbackError) {
      rollbackFailure = rollbackError
    }
    if (rollbackFailure) {
      throw new AggregateError(
        [error, rollbackFailure],
        'Version update failed and precommit files could not be fully restored.',
        { cause: error },
      )
    }
    throw error
  }

  /** 保留内存原值及后续磁盘快照，直至提交入口或失败恢复完成 */
  function retainPlan(plan: PreparedVersionPlan): void {
    preparedVersionPlan = plan
    rollbackData = context.appData
    const originalExistingPkgNames = context.appData.existingPkgNames
    const originalIsReleaseRetry = context.appData.isReleaseRetry
    registerPrecommitRollback(
      context.appData,
      async () => {
        try {
          if (manifestSnapshot) await restoreLockfiles(manifestSnapshot)
        } finally {
          context.appData.workspacePackages = plan.originalWorkspacePackages
          context.appData.projectPkg = plan.originalProjectPkg
          if (originalExistingPkgNames === undefined) {
            delete context.appData.existingPkgNames
          } else {
            context.appData.existingPkgNames = originalExistingPkgNames
          }
          if (originalIsReleaseRetry === undefined) {
            delete context.appData.isReleaseRetry
          } else {
            context.appData.isReleaseRetry = originalIsReleaseRetry
          }
        }
      },
      () => {
        preparedVersionPlan = undefined
        manifestSnapshot = undefined
        rollbackData = undefined
      },
    )
  }

  context.onCheck(async ({ releaseTypeOrVersion }) => {
    if (releaseTypeOrVersion && !isVersionValid(releaseTypeOrVersion, true)) {
      throw new AppError(
        `Invalid semantic version ${chalk.cyan(releaseTypeOrVersion)}.`,
      )
    }
  })

  context.getIncrementVersion(
    async ({ releaseTypeOrVersion, retry }) => {
      const version = await getIncrementVersion(
        context,
        releaseTypeOrVersion,
        retry,
      )

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

      const publishablePackageNames = context.appData.workspacePackages
        .filter(({ manifest }) => !manifest.private)
        .map(({ manifest }) => manifest.name)
      const existingPkgNames: string[] = []
      const versionChecks = await mapWithConcurrency(
        publishablePackageNames,
        context.config.npm.networkConcurrency,
        async pkgName => ({
          exists: await checkVersion(
            pkgName,
            version,
            context.appData.registry,
            context.cwd,
            context.signal,
          ),
          pkgName,
        }),
      )
      const releaseTagNames = context.config.git.independent
        ? publishablePackageNames.map(pkgName => `${pkgName}@${version}`)
        : [`v${version}`]
      const workspaceVersions = new Map(
        context.appData.workspacePackages.map(({ manifest }) => [
          manifest.name,
          manifest.version,
        ]),
      )
      const allPackagesAtTarget = context.appData.workspacePackages.every(
        ({ manifest }) => manifest.version === version,
      )
      const shouldCheckReleaseTags =
        versionChecks.some(({ exists }) => exists) ||
        publishablePackageNames.every(
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
                      signal: context.signal,
                      verbose: false,
                    }),
                  ] as const,
              ),
            )
          : [],
      )
      const isReleaseRetry =
        shouldCheckReleaseTags &&
        releaseTagNames.length > 0 &&
        (releaseTagNames.every(tagName => tagChecks.get(tagName) === true) ||
          // 独立标签可能在首次发布前中断，已有 HEAD 标签和一致版本共同确认重试
          (context.config.git.independent &&
            allPackagesAtTarget &&
            releaseTagNames.some(tagName => tagChecks.get(tagName) === true)))

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

      const plan = await prepareVersionPlan(context.appData, version)
      retainPlan(plan)
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

      context.appData.workspacePackages = plan.workspacePackages
      context.appData.projectPkg = plan.projectPkg
    },
  )

  context.onBumpVersion(async ({ version }) => {
    const plan =
      preparedVersionPlan?.version === version
        ? preparedVersionPlan
        : await prepareVersionPlan(context.appData, version)
    if (preparedVersionPlan !== plan) retainPlan(plan)
    context.appData.workspacePackages = plan.workspacePackages
    context.appData.projectPkg = plan.projectPkg
    debug?.(
      context.appData.workspacePackages.map(({ manifest }) => manifest.name),
    )

    if (!context.config.dryRun) {
      try {
        manifestSnapshot = await captureFileSnapshots(
          plan.manifests.map(manifest => manifest.path),
        )
        await writeVersionPlan(plan, false)
      } catch (error) {
        await restoreAfterFailure(error)
      }
    }
  })

  context.onAfterBumpVersion(async ({ version }) => {
    if (isCanaryVersion(version) || context.config.dryRun) {
      return
    }

    context.step('Updating Lockfile ...')

    try {
      const snapshot = await captureLockfiles(context.cwd)
      registerPrecommitRollback(context.appData, () =>
        restoreLockfiles(snapshot),
      )
      await updatePackageLock(
        context.appData.packageManager,
        {
          cwd: context.cwd,
          signal: context.signal,
          verbose: true,
        },
        context.appData.packageManagerVariant,
      )
    } catch (lockfileError) {
      await restoreAfterFailure(lockfileError)
    }
  })
})

async function getIncrementVersion(
  context: ReleasePluginContext,
  releaseTypeOrVersion?: string,
  retry?: boolean,
): Promise<string> {
  const { prerelease, prereleaseId, canary } = context.config.npm
  const { registry, projectPkg, workspacePackages } = context.appData
  const publishablePackageNames = workspacePackages
    .filter(({ manifest }) => !manifest.private)
    .map(({ manifest }) => manifest.name)

  context.step('Incrementing version ...')

  if (retry) {
    // 重试目标由本地 release 标签决定，无需查询远程 dist-tag 或计算增量
    const retryVersion = await findRetryVersionAtHead(
      context.cwd,
      context.config.git.independent,
      { signal: context.signal },
      publishablePackageNames,
    )

    if (!retryVersion) {
      throw new AppError(
        `No release tag points at HEAD. Confirm the failed release commit and tags are unchanged, then rerun with an exact version such as ${chalk.cyan('release 1.2.3')}.`,
      )
    }

    return retryVersion
  }

  if (
    releaseTypeOrVersion &&
    !RELEASE_TYPES.includes(releaseTypeOrVersion as ReleaseType)
  ) {
    return releaseTypeOrVersion
  }

  const localVersion = getMaxVersion(
    projectPkg.version,
    ...workspacePackages
      .map(({ manifest }) => manifest.version)
      .filter((version): version is string => Boolean(version)),
  )
  const remoteQueryOptions = {
    cwd: context.cwd,
    registry,
    signal: context.signal,
  }
  const remoteDistTags =
    prereleaseId && !['alpha', 'beta', 'rc'].includes(prereleaseId)
      ? await getRemoteDistTag(
          publishablePackageNames,
          remoteQueryOptions,
          ['latest', 'alpha', 'beta', 'rc', prereleaseId],
          context.config.npm.networkConcurrency,
        )
      : await getRemoteDistTag(
          publishablePackageNames,
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
      answer = await prompts(
        {
          name: 'value',
          type: 'text',
          message: 'Please input the custom version:',
        },
        { onCancel },
      )
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
  signal?: AbortSignal,
): Promise<boolean> {
  if (!semver.valid(version)) {
    throw new AppError(`Invalid semantic version ${chalk.cyan(version)}.`)
  }

  return isVersionExist(pkgName, version, registry, cwd, signal)
}

async function confirmVersion(
  context: ReleasePluginContext,
  initialVersion: string,
): Promise<string> {
  const publishablePackageNames = context.appData.workspacePackages
    .filter(({ manifest }) => !manifest.private)
    .map(({ manifest }) => manifest.name)

  if (!publishablePackageNames.length) {
    return initialVersion
  }

  let version = initialVersion

  while (true) {
    let confirmMessage: string

    if (publishablePackageNames.length === 1) {
      confirmMessage = `Are you sure to bump version to ${chalk.cyan(version)}`
    } else {
      console.log(`The packages will be bumped are as follows:${EOL}`)

      for (const pkgName of publishablePackageNames) {
        console.log(` - ${chalk.cyan(`${pkgName}@${version}`)}`)
      }

      console.log()
      confirmMessage = 'Are you sure to bump?'
    }

    const answer = await confirm(confirmMessage, undefined, onCancel)
    console.log()

    if (answer) {
      return version
    }

    version = await getIncrementVersion(context)
  }
}
