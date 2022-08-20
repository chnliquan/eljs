import { chalk, logger, prompts } from '@eljs/utils'
import fs from 'fs'
import semver from 'semver'
import { getDistTag, getReferenceVersion, isVersionExist } from './version'

const VERSION_MAJOR = 'Major'
const VERSION_MINOR = 'Minor'
const VERSION_PATCH = 'Patch'

const VERSION_PRE_RELEASE = 'Prerelease'
const VERSION_PRE_MAJOR = 'Premajor'
const VERSION_PRE_MINOR = 'Preminor'
const VERSION_PRE_PATCH = 'Prepatch'

function generatePreVersionQuestions(
  type: 'Beta' | 'Alpha' | 'Rc',
  suggestions: Record<string, any>,
): any[] {
  return [
    {
      name: 'value',
      type: 'select',
      message: `Please select the ${type} version number to upgrade`,
      choices: [
        VERSION_PRE_RELEASE,
        VERSION_PRE_PATCH,
        VERSION_PRE_MINOR,
        VERSION_PRE_MAJOR,
      ].map(item => ({
        title: `${item === VERSION_PRE_RELEASE ? item : item + '  '} (${
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

  const choices = [
    {
      title: `${VERSION_PATCH} (${suggestions[VERSION_PATCH]})`,
      value: suggestions[VERSION_PATCH] as string,
      description: chalk.grey(`Bug Fix`),
    },
    {
      title: `${VERSION_MINOR} (${suggestions[VERSION_MINOR]})`,
      value: suggestions[VERSION_MINOR] as string,
      description: chalk.grey(`New Feature`),
    },
    {
      title: `${VERSION_MAJOR} (${suggestions[VERSION_MAJOR]})`,
      value: suggestions[VERSION_MAJOR] as string,
      description: chalk.grey(`Breaking Change`),
    },
    {
      title: `Beta`,
      value: 'Beta',
      description: chalk.grey(`External Test Version`),
    },
    {
      title: `Alpha`,
      value: 'Alpha',
      description: chalk.grey(`Internal Test Version`),
    },
    {
      title: `Rc`,
      value: 'Rc',
      description: chalk.grey(`Release candidate`),
    },
  ]

  let targetVersion = await prompts([
    {
      name: 'value',
      type: 'select',
      message: 'Please select the version number to be upgraded:',
      choices,
    },
  ])

  switch (targetVersion.value) {
    case 'Beta':
      targetVersion = await prompts(
        generatePreVersionQuestions('Beta', suggestions),
      )
      break

    case 'Alpha':
      targetVersion = await prompts(
        generatePreVersionQuestions('Alpha', suggestions),
      )
      break

    case 'Rc':
      targetVersion = await prompts(
        generatePreVersionQuestions('Rc', suggestions),
      )
      break
    default:
      break
  }

  console.log(targetVersion.value)
  process.exit(0)
}
