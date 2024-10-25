import { VERSION_TAGS } from '@/constants'
import type { DistTag } from '@/types'
import { chalk, logger, pascalCase, prompts, type PkgJSON } from '@eljs/utils'
import semver from 'semver'
import {
  getDistTag,
  getReferenceVersion,
  getVersion,
  isVersionExist,
} from './version'

function getPreVersionPromptQuestions(
  referenceVersion: string,
  distTag: DistTag,
): prompts.PromptObject {
  return {
    name: 'value',
    type: 'select',
    message: `Please select the ${distTag} version to bump:`,
    choices: ['prerelease', 'prepatch', 'preminor', 'premajor'].map(item => {
      const version = getVersion({
        referenceVersion,
        targetVersion: item,
        distTag,
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
  pkgJSON: Required<PkgJSON>
  publishPkgNames: string[]
  distTag?: DistTag
  targetVersion?: string
}): Promise<string> {
  const { cwd, pkgJSON, publishPkgNames, distTag, targetVersion } = opts

  const localVersion = pkgJSON.version
  const {
    remoteLatestVersion,
    remoteAlphaVersion,
    remoteBetaVersion,
    remoteNextVersion,
  } = await getDistTag(publishPkgNames, cwd)

  const latestReferenceVersion = getReferenceVersion(
    localVersion,
    remoteLatestVersion,
  )
  const alphaReferenceVersion = getReferenceVersion(
    localVersion,
    remoteAlphaVersion || remoteLatestVersion,
  )
  const betaReferenceVersion = getReferenceVersion(
    localVersion,
    remoteBetaVersion || remoteLatestVersion,
  )
  const nextReferenceVersion = getReferenceVersion(
    localVersion,
    remoteNextVersion || remoteLatestVersion,
  )

  const tag2referenceVersionMap = {
    alpha: alphaReferenceVersion,
    beta: betaReferenceVersion,
    next: nextReferenceVersion,
    latest: latestReferenceVersion,
  }

  logger.info(`- Local version: ${chalk.cyanBright.bold(localVersion)}`)

  if (remoteLatestVersion) {
    logger.info(
      `- Remote latest version: ${chalk.cyanBright.bold(remoteLatestVersion)}`,
    )
  }

  if (remoteAlphaVersion && (!distTag || distTag === 'alpha')) {
    logger.info(
      `- Remote alpha version: ${chalk.cyanBright.bold(remoteAlphaVersion)}`,
    )
  }

  if (remoteBetaVersion && (!distTag || distTag === 'beta')) {
    logger.info(
      `- Remote beta version: ${chalk.cyanBright.bold(remoteBetaVersion)}`,
    )
  }

  if (remoteNextVersion && (!distTag || distTag === 'next')) {
    logger.info(
      `- Remote next version: ${chalk.cyanBright.bold(remoteNextVersion)}`,
    )
  }

  console.log()

  if (targetVersion) {
    if (VERSION_TAGS.includes(targetVersion)) {
      return getVersion({
        targetVersion,
        referenceVersion: distTag
          ? tag2referenceVersionMap[distTag]
          : latestReferenceVersion,
        distTag,
      })
    } else {
      if (!semver.valid(targetVersion)) {
        logger.printErrorAndExit(
          `${publishPkgNames[0]} has already published v${chalk.bold(
            targetVersion,
          )}.`,
        )
      }

      const isExist = await isVersionExist(publishPkgNames[0], targetVersion)

      if (isExist) {
        logger.printErrorAndExit(
          `${publishPkgNames[0]} has already published v${chalk.bold(
            targetVersion,
          )}.`,
        )
      } else {
        return targetVersion
      }
    }
  }

  const patchVersion = getVersion({
    referenceVersion: latestReferenceVersion,
    targetVersion: 'patch',
  })

  const minorVersion = getVersion({
    referenceVersion: latestReferenceVersion,
    targetVersion: 'minor',
  })

  const majorVersion = getVersion({
    referenceVersion: latestReferenceVersion,
    targetVersion: 'major',
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
      title: `Next`,
      value: 'next',
      description: chalk.grey(`Candidate Version`),
    },
  ]

  let answer: prompts.Answers<'value'> = {
    value: '',
  }

  const onCancel = () => {
    process.exit(1)
  }

  if (!distTag) {
    answer = await prompts(
      [
        {
          name: 'value',
          type: 'select',
          message: 'Please select the version to bump:',
          choices,
        },
      ],
      {
        onCancel,
      },
    )

    if (['alpha', 'beta', 'next'].includes(answer.value)) {
      const referenceVersion = tag2referenceVersionMap[answer.value as 'alpha']
      answer = await prompts(
        getPreVersionPromptQuestions(referenceVersion, answer.value),
        {
          onCancel,
        },
      )
    }
  } else {
    if (distTag === 'latest') {
      answer = await prompts(
        [
          {
            name: 'value',
            type: 'select',
            message: 'Please select the version to bump:',
            choices: choices.slice(0, 3),
          },
        ],
        {
          onCancel,
        },
      )
    } else {
      const referenceVersion = tag2referenceVersionMap[distTag]
      answer = await prompts(
        getPreVersionPromptQuestions(referenceVersion, distTag),
        {
          onCancel,
        },
      )
    }
  }

  return answer.value
}
