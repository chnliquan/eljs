import type { Preid } from '@/types'
import {
  getCanaryVersion,
  getMaxVersion,
  getReleaseVersion,
  getRemoteDistTag,
  isVersionExist,
} from '@/utils'
import { chalk, logger, pascalCase, prompts, type PkgJSON } from '@eljs/utils'
import semver, { RELEASE_TYPES, type ReleaseType } from 'semver'

function getPreVersionPromptQuestions(
  referenceVersion: string,
  preid: Preid,
): prompts.PromptObject {
  return {
    name: 'value',
    type: 'select',
    message: `Please select the ${preid} version to bump:`,
    choices: ['prerelease', 'prepatch', 'preminor', 'premajor'].map(item => {
      const version = getReleaseVersion({
        referenceVersion,
        releaseType: item as ReleaseType,
        preid,
      })
      return {
        title: `${
          item === 'prerelease' ? pascalCase(item) : pascalCase(item) + '  '
        } (${version})`,
        value: version,
      }
    }),
  }
}

export async function getBumpVersion(opts: {
  cwd: string
  registry: string
  canary: boolean
  pkgJSON: Required<PkgJSON>
  publishPkgNames: string[]
  preid?: Preid
  releaseTypeOrVersion?: ReleaseType | string
}): Promise<string> {
  const {
    cwd,
    registry,
    canary,
    pkgJSON,
    publishPkgNames,
    preid,
    releaseTypeOrVersion,
  } = opts

  // #region 用户传入版本
  if (
    releaseTypeOrVersion &&
    !RELEASE_TYPES.includes(releaseTypeOrVersion as ReleaseType)
  ) {
    await checkVersion(releaseTypeOrVersion)
    return releaseTypeOrVersion
  }

  const localVersion = pkgJSON.version
  const {
    latest: remoteLatestVersion,
    alpha: remoteAlphaVersion,
    beta: remoteBetaVersion,
    rc: remoteRcVersion,
  } = await getRemoteDistTag(publishPkgNames, cwd, registry)

  const referenceVersionMap = {
    latest: getMaxVersion(localVersion, remoteLatestVersion),
    alpha: getMaxVersion(localVersion, remoteLatestVersion, remoteAlphaVersion),
    beta: getMaxVersion(localVersion, remoteLatestVersion, remoteBetaVersion),
    rc: getMaxVersion(localVersion, remoteLatestVersion, remoteRcVersion),
  }

  if (RELEASE_TYPES.includes(releaseTypeOrVersion as ReleaseType)) {
    return getReleaseVersion({
      releaseType: releaseTypeOrVersion as ReleaseType,
      referenceVersion: preid
        ? referenceVersionMap[preid]
        : referenceVersionMap.latest,
      preid,
    })
  }
  // #endregion

  if (canary) {
    return getCanaryVersion(referenceVersionMap.latest, cwd)
  } else {
    logger.info(`- Local version: ${chalk.cyanBright.bold(localVersion)}`)

    if (remoteLatestVersion) {
      logger.info(
        `- Remote latest version: ${chalk.cyanBright.bold(
          remoteLatestVersion,
        )}`,
      )
    }

    if (remoteAlphaVersion && (!preid || preid === 'alpha')) {
      logger.info(
        `- Remote alpha version: ${chalk.cyanBright.bold(remoteAlphaVersion)}`,
      )
    }

    if (remoteBetaVersion && (!preid || preid === 'beta')) {
      logger.info(
        `- Remote beta version: ${chalk.cyanBright.bold(remoteBetaVersion)}`,
      )
    }

    if (remoteRcVersion && (!preid || preid === 'rc')) {
      logger.info(
        `- Remote rc version: ${chalk.cyanBright.bold(remoteRcVersion)}`,
      )
    }
  }

  console.log()

  const patchVersion = getReleaseVersion({
    referenceVersion: referenceVersionMap.latest,
    releaseType: 'patch',
  })

  const minorVersion = getReleaseVersion({
    referenceVersion: referenceVersionMap.latest,
    releaseType: 'minor',
  })

  const majorVersion = getReleaseVersion({
    referenceVersion: referenceVersionMap.latest,
    releaseType: 'major',
  })

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

  if (!preid) {
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
      return getCanaryVersion(referenceVersionMap.latest, cwd)
    }

    if (releaseType === 'custom') {
      answer = await prompts({
        name: 'value',
        type: 'text',
        message: 'Input custom version:',
        initial: pkgJSON.version,
      })

      await checkVersion(answer.value)
      return answer.value
    }

    if (!['alpha', 'beta', 'rc'].includes(releaseType as Preid)) {
      return answer.value
    }
  }

  // preid version
  const referenceVersion = referenceVersionMap[answer.value as Preid]
  answer = await prompts(
    getPreVersionPromptQuestions(referenceVersion, releaseType as Preid),
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

    const isExist = await isVersionExist(publishPkgNames[0], version as string)

    if (isExist) {
      logger.printErrorAndExit(
        `${publishPkgNames[0]} has published v${chalk.bold(version)} already.`,
      )
    }
  }
}
