import chalk from 'chalk'
import fs from 'fs'
import inquirer from 'inquirer'
import semver from 'semver'
import { logger } from './utils/logger'
import {
  getDistTag,
  getReferenceVersion,
  isVersionExist,
} from './utils/version'

const VERSION_MAJOR = 'Major'
const VERSION_MINOR = 'Minor'
const VERSION_PATCH = 'Patch'

const VERSION_PRE_RELEASE = 'Prerelease'
const VERSION_PRE_MAJOR = 'Premajor'
const VERSION_PRE_MINOR = 'Preminor'
const VERSION_PRE_PATCH = 'Prepatch'

function generatePreVersionQuestions(
  type: 'Beta' | 'Alpha' | 'Rc',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  suggestions: Record<string, any>,
) {
  return [
    {
      name: 'value',
      type: 'list',
      message: `Please select the ${type} version number to upgrade`,
      choices: [
        VERSION_PRE_RELEASE,
        VERSION_PRE_PATCH,
        VERSION_PRE_MINOR,
        VERSION_PRE_MAJOR,
      ].map(item => ({
        short: suggestions[type][VERSION_PRE_MAJOR],
        name: `${item === VERSION_PRE_RELEASE ? item : item + '  '} (${
          suggestions[type][item]
        })`,
        value: suggestions[type][item],
      })),
    },
  ]
}

function generatePreVersionSuggestion(
  type: 'Beta' | 'Alpha' | 'Rc',
  referenceVersion: string,
) {
  return {
    [VERSION_PRE_MAJOR]: semver.inc(
      referenceVersion,
      VERSION_PRE_MAJOR.toLowerCase() as semver.ReleaseType,
      type.toLocaleLowerCase(),
    ),
    [VERSION_PRE_MINOR]: semver.inc(
      referenceVersion,
      VERSION_PRE_MINOR.toLowerCase() as semver.ReleaseType,
      type.toLocaleLowerCase(),
    ),
    [VERSION_PRE_PATCH]: semver.inc(
      referenceVersion,
      VERSION_PRE_PATCH.toLowerCase() as semver.ReleaseType,
      type.toLocaleLowerCase(),
    ),
    [VERSION_PRE_RELEASE]: semver.inc(
      referenceVersion,
      VERSION_PRE_RELEASE.toLowerCase() as semver.ReleaseType,
      type.toLocaleLowerCase(),
    ),
  }
}

export async function getTargetVersion(
  rootPkgPath: string,
  isMonorepo = false,
  specifiedTargetVersion?: string,
): Promise<string> {
  if (!rootPkgPath || !fs.existsSync(rootPkgPath)) {
    logger.printErrorAndExit(`package.json file ${rootPkgPath} is not exist.`)
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pkg = require(rootPkgPath)

  if (!pkg || !pkg.version) {
    logger.printErrorAndExit(`package.json file ${rootPkgPath} is not valid.`)
  }

  const localVersion = pkg.version
  let remoteLatestVersion: string | undefined
  let remoteAlphaVersion: string | undefined
  let remoteBetaVersion: string | undefined
  let remoteNextVersion: string | undefined

  if (!isMonorepo) {
    const distTag = await getDistTag(pkg.name)
    remoteLatestVersion = distTag.remoteLatestVersion
    remoteAlphaVersion = distTag.remoteAlphaVersion
    remoteBetaVersion = distTag.remoteBetaVersion
    remoteNextVersion = distTag.remoteNextVersion

    logger.info(`- Local version: ${chalk.cyanBright.bold(localVersion)}`)

    if (remoteLatestVersion) {
      logger.info(
        `- Remote latest version: ${chalk.cyanBright.bold(
          remoteLatestVersion,
        )}`,
      )
    }

    if (remoteAlphaVersion) {
      logger.info(
        `- Remote alpha version:  ${chalk.cyanBright.bold(remoteAlphaVersion)}`,
      )
    }

    if (remoteBetaVersion) {
      logger.info(
        `- Remote beta version:   ${chalk.cyanBright.bold(remoteBetaVersion)}`,
      )
    }

    if (remoteNextVersion) {
      logger.info(
        `- Remote next version:   ${chalk.cyanBright.bold(remoteNextVersion)}`,
      )
    }

    console.log()
  }

  // specified target version, check version exist
  if (specifiedTargetVersion) {
    const isExist = await isVersionExist(pkg.name, specifiedTargetVersion)

    if (isExist) {
      logger.error(
        `This package ${pkg.name} is already published v${chalk.bold(
          specifiedTargetVersion,
        )}, please check your targetVersion.`,
      )
      process.exit(1)
    } else {
      logger.warn(`- Specified target version: ${specifiedTargetVersion}`)
      return specifiedTargetVersion
    }
  }

  const latestReferenceVersion = getReferenceVersion(
    localVersion,
    remoteLatestVersion,
  )
  const alphaReferenceVersion = getReferenceVersion(
    localVersion,
    remoteAlphaVersion,
  )
  const betaReferenceVersion = getReferenceVersion(
    localVersion,
    remoteBetaVersion,
  )
  const nextReferenceVersion = getReferenceVersion(
    localVersion,
    remoteNextVersion,
  )

  const suggestions = {
    [VERSION_MAJOR]: semver.inc(
      latestReferenceVersion,
      VERSION_MAJOR.toLowerCase() as semver.ReleaseType,
    ),
    [VERSION_MINOR]: semver.inc(
      latestReferenceVersion,
      VERSION_MINOR.toLowerCase() as semver.ReleaseType,
    ),
    [VERSION_PATCH]: semver.inc(
      latestReferenceVersion,
      VERSION_PATCH.toLowerCase() as semver.ReleaseType,
    ),
    Alpha: generatePreVersionSuggestion('Alpha', alphaReferenceVersion),
    Beta: generatePreVersionSuggestion('Beta', betaReferenceVersion),
    Rc: generatePreVersionSuggestion('Rc', nextReferenceVersion),
  }

  const maxVersionName = Math.max(
    `${VERSION_PATCH} (${suggestions[VERSION_PATCH]})`.length,
    `${VERSION_MINOR} (${suggestions[VERSION_MINOR]})`.length,
    `${VERSION_MAJOR} (${suggestions[VERSION_MAJOR]})`.length,
  )
  const choices = [
    {
      short: suggestions[VERSION_PATCH],
      name: `${`${VERSION_PATCH} (${suggestions[VERSION_PATCH]})`.padEnd(
        maxVersionName,
        ' ',
      )} ${chalk.grey(`- Bug Fix`)}`,
      value: suggestions[VERSION_PATCH],
    },
    {
      short: suggestions[VERSION_MINOR],
      name: `${`${VERSION_MINOR} (${suggestions[VERSION_MINOR]})`.padEnd(
        maxVersionName,
        ' ',
      )} ${chalk.grey(`- New Feature`)}`,
      value: suggestions[VERSION_MINOR],
    },
    {
      short: suggestions[VERSION_MAJOR],
      name: `${`${VERSION_MAJOR} (${suggestions[VERSION_MAJOR]})`.padEnd(
        maxVersionName,
        ' ',
      )} ${chalk.grey(`- Breaking Change`)}`,
      value: suggestions[VERSION_MAJOR],
    },
    {
      name: `${'Beta'.padEnd(maxVersionName, ' ')} ${chalk.grey(
        `- External Test Version`,
      )}`,
      value: 'Beta',
    },
    {
      name: `${'Alpha'.padEnd(maxVersionName, ' ')} ${chalk.grey(
        `- Internal Test Version`,
      )}`,
      value: 'Alpha',
    },
    {
      name: `${'Rc'.padEnd(maxVersionName, ' ')} ${chalk.grey(
        `- Release candidate`,
      )}`,
      value: 'Rc',
    },
  ]

  let targetVersion = await inquirer.prompt([
    {
      name: 'value',
      type: 'list',
      message: 'Please select the version number to be upgraded:',
      choices,
    },
  ])

  switch (targetVersion.value) {
    case 'Beta':
      targetVersion = await inquirer.prompt(
        generatePreVersionQuestions('Beta', suggestions),
      )
      break

    case 'Alpha':
      targetVersion = await inquirer.prompt(
        generatePreVersionQuestions('Alpha', suggestions),
      )
      break

    case 'Rc':
      targetVersion = await inquirer.prompt(
        generatePreVersionQuestions('Rc', suggestions),
      )
      break
    default:
      break
  }

  return targetVersion.value
}
