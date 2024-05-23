import { chalk, logger, pascalCase, PkgJSON, prompts } from '@eljs/utils'
import semver from 'semver'
import { VERSION_TAGS } from '../constants'
import { PublishTag } from '../types'
import {
  getDistTag,
  getReferenceVersion,
  getVersion,
  isVersionExist,
} from './version'

function getPreVersionPromptQuestions(
  referenceVersion: string,
  tag: PublishTag,
): prompts.PromptObject {
  return {
    name: 'value',
    type: 'select',
    message: `Please select the ${tag} version to bump:`,
    choices: ['prerelease', 'prepatch', 'preminor', 'premajor'].map(item => {
      const version = getVersion({
        referenceVersion,
        targetVersion: item,
        tag,
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
  pkgJSON: Required<PkgJSON>
  publishPkgNames: string[]
  tag?: PublishTag
  targetVersion?: string
}): Promise<string> {
  const { pkgJSON, publishPkgNames, tag, targetVersion } = opts

  const localVersion = pkgJSON.version
  const {
    remoteLatestVersion,
    remoteAlphaVersion,
    remoteBetaVersion,
    remoteNextVersion,
  } = await getDistTag(publishPkgNames)

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

  if (remoteAlphaVersion && (!tag || tag === 'alpha')) {
    logger.info(
      `- Remote alpha version: ${chalk.cyanBright.bold(remoteAlphaVersion)}`,
    )
  }

  if (remoteBetaVersion && (!tag || tag === 'beta')) {
    logger.info(
      `- Remote beta version: ${chalk.cyanBright.bold(remoteBetaVersion)}`,
    )
  }

  if (remoteNextVersion && (!tag || tag === 'next')) {
    logger.info(
      `- Remote next version: ${chalk.cyanBright.bold(remoteNextVersion)}`,
    )
  }

  console.log()

  if (targetVersion) {
    if (VERSION_TAGS.includes(targetVersion)) {
      return getVersion({
        targetVersion,
        referenceVersion: tag
          ? tag2referenceVersionMap[tag]
          : latestReferenceVersion,
        tag,
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

  if (!tag) {
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
    if (tag === 'latest') {
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
      const referenceVersion = tag2referenceVersionMap[tag]
      answer = await prompts(
        getPreVersionPromptQuestions(referenceVersion, tag),
        {
          onCancel,
        },
      )
    }
  }

  return answer.value
}
