import type { Preid } from '@/types'
import { chalk, logger, pascalCase, prompts, type PkgJSON } from '@eljs/utils'
import semver, { RELEASE_TYPES, type ReleaseType } from 'semver'
import {
  getCanaryVersion,
  getReferenceVersion,
  getReleaseVersion,
  getRemoteDistTag,
  isVersionExist,
} from './version'

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
  pkgJSON: Required<PkgJSON>
  publishPkgNames: string[]
  preid?: Preid
  releaseTypeOrVersion?: ReleaseType | string
}): Promise<string> {
  const { cwd, pkgJSON, publishPkgNames, preid, releaseTypeOrVersion } = opts

  if (
    releaseTypeOrVersion &&
    !RELEASE_TYPES.includes(releaseTypeOrVersion as ReleaseType)
  ) {
    if (!semver.valid(releaseTypeOrVersion)) {
      logger.printErrorAndExit(
        `Invalid semantic version ${chalk.bold(releaseTypeOrVersion)}.`,
      )
    }

    const isExist = await isVersionExist(
      publishPkgNames[0],
      releaseTypeOrVersion,
    )

    if (isExist) {
      logger.printErrorAndExit(
        `${publishPkgNames[0]} has published v${chalk.bold(
          releaseTypeOrVersion,
        )} already.`,
      )
    } else {
      return releaseTypeOrVersion
    }
  }

  const localVersion = pkgJSON.version
  const { latest, alpha, beta, rc } = await getRemoteDistTag(
    publishPkgNames,
    cwd,
  )

  const referenceVersionMap = {
    latest: getReferenceVersion(localVersion, latest),
    alpha: getReferenceVersion(localVersion, alpha || latest),
    beta: getReferenceVersion(localVersion, beta || latest),
    rc: getReferenceVersion(localVersion, rc || latest),
  }

  if (RELEASE_TYPES.includes(releaseTypeOrVersion as ReleaseType)) {
    return getReleaseVersion({
      releaseType: releaseTypeOrVersion as ReleaseType,
      referenceVersion: preid
        ? referenceVersionMap[preid as keyof typeof referenceVersionMap]
        : referenceVersionMap.latest,
      preid,
    })
  }

  if (preid === 'canary') {
    return getCanaryVersion(referenceVersionMap.latest, cwd)
  } else {
    logger.info(`- Local version: ${chalk.cyanBright.bold(localVersion)}`)

    if (referenceVersionMap.latest) {
      logger.info(
        `- Remote latest version: ${chalk.cyanBright.bold(
          referenceVersionMap.latest,
        )}`,
      )
    }

    if (referenceVersionMap.alpha && (!preid || preid === 'alpha')) {
      logger.info(
        `- Remote alpha version: ${chalk.cyanBright.bold(
          referenceVersionMap.alpha,
        )}`,
      )
    }

    if (referenceVersionMap.beta && (!preid || preid === 'beta')) {
      logger.info(
        `- Remote beta version: ${chalk.cyanBright.bold(
          referenceVersionMap.beta,
        )}`,
      )
    }

    if (referenceVersionMap.rc && (!preid || preid === 'rc')) {
      logger.info(
        `- Remote rc version: ${chalk.cyanBright.bold(referenceVersionMap.rc)}`,
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
      description: chalk.grey(`Canary Version`),
    },
  ]

  let answer: prompts.Answers<'value'> = {
    value: '',
  }

  const onCancel = () => {
    process.exit(1)
  }

  let resolvedPreid: Preid | undefined = preid

  if (!resolvedPreid) {
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

    resolvedPreid = answer.value

    if (resolvedPreid === 'canary') {
      return getCanaryVersion(referenceVersionMap.latest, cwd)
    }

    if (!['alpha', 'beta', 'rc'].includes(resolvedPreid as Preid)) {
      return answer.value
    }
  }

  const referenceVersion =
    referenceVersionMap[answer.value as keyof typeof referenceVersionMap]
  answer = await prompts(
    getPreVersionPromptQuestions(referenceVersion, resolvedPreid as Preid),
    {
      onCancel,
    },
  )

  return answer.value
}
