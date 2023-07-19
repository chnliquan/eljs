import {
  chalk,
  confirm,
  execa,
  existsSync,
  isMonorepo,
  logger,
  PkgJSON,
  readJSONSync,
  run,
} from '@eljs/utils'
import githubReleaseUrl from 'new-github-release-url'
import open from 'open'
import path from 'path'
import resolveBin from 'resolve-bin'
import { URL } from 'url'

import { getTargetVersion } from '../prompt'
import { Options, PublishTag } from '../types'
import { getPkgPaths } from '../utils/pkg'
import {
  isAlphaVersion,
  isBetaVersion,
  isPrerelease,
  isRcVersion,
} from '../utils/version'
import { generateChangelog } from './changelog'
import { updateLock, updateVersions } from './update'

export const step = logger.step('Release')

/**
 * Workflow
 *
 * 1. Make changes
 * 2. Commit those changes
 * 3. Make sure Travis turns green
 * 4. Bump version in package.json
 * 5. conventionalChangelog
 * 6. Commit package.json and CHANGELOG.md files
 * 7. Tag
 * 8. Push
 */
export async function release(opts: Options): Promise<void> {
  const {
    cwd = process.cwd(),
    gitChecks = true,
    verbose = false,
    print = false,
  } = opts

  // check git status
  if (gitChecks) {
    await gitCheck()
  }

  const {
    rootPkgJSONPath,
    rootPkgJSON,
    monorepo,
    pkgNames,
    pkgJSONPaths,
    pkgJSONs,
    publishPkgDirs,
    publishPkgNames,
  } = await init(cwd)

  const defaultOptions: Options = {
    registryChecks: true,
    ownershipChecks: false,
    syncCnpm: false,
    repoUrl: rootPkgJSON?.repository?.url || '',
    changelogPreset: '@eljs/changelog-preset',
    latest: true,
    githubRelease: true,
  }

  const {
    targetVersion: customVersion,
    registryChecks,
    ownershipChecks,
    tag,
    syncCnpm,
    repoType: customRepoType,
    repoUrl,
    changelogPreset,
    latest,
    githubRelease,
    beforeUpdateVersion,
    beforeChangelog,
  } = Object.assign(defaultOptions, opts)

  const repoType =
    customRepoType || (repoUrl?.includes('github') ? 'github' : 'gitlab')

  // check registry
  if (registryChecks) {
    await registryCheck({
      repoType,
      repoUrl,
      pkgRegistry: rootPkgJSON?.publishConfig?.registry,
    })
  }

  // check ownership
  if (ownershipChecks) {
    await ownershipCheck(publishPkgNames)
  }

  // bump version
  step('Bump version ...')
  let targetVersion = await getTargetVersion({
    pkgJSON: rootPkgJSON,
    publishPkgNames: monorepo ? publishPkgNames : [rootPkgJSON.name],
    tag,
    customVersion,
  })

  if (print) {
    publishPkgNames.forEach(pkgName =>
      console.log(` - ${chalk.cyanBright(`${pkgName}@${targetVersion}`)}`),
    )
    return
  }

  if (!customVersion) {
    targetVersion = await reconfirm({
      targetVersion,
      publishPkgNames,
      pkgJSON: rootPkgJSON,
      monorepo,
      tag,
      verbose,
    })
  }

  if (typeof beforeUpdateVersion === 'function') {
    await beforeUpdateVersion(targetVersion)
  }

  // update all package versions and inter-dependencies
  step('Updating versions ...')
  await updateVersions({
    rootPkgJSONPath,
    rootPkgJSON,
    monorepo,
    pkgNames,
    pkgJSONPaths,
    pkgJSONs,
    version: targetVersion,
  })

  // update pnpm-lock.yaml or package-lock.json
  step('Updating lockfile...')
  await updateLock({
    monorepo,
    version: targetVersion,
    rootDir: cwd,
  })

  if (typeof beforeChangelog === 'function') {
    await beforeChangelog()
  }

  // generate changelog
  step(`Generating changelog ...`)
  const changelog = await generateChangelog({
    changelogPreset: changelogPreset as string,
    latest,
    pkgName: rootPkgJSON.name as string,
    cwd,
  })

  // commit git changes
  await commit(targetVersion)

  // publish package
  await publish({
    version: targetVersion,
    publishPkgDirs,
    publishPkgNames,
    tag,
    gitChecks,
    changelog,
    repoType,
    repoUrl,
    githubRelease,
  })

  // sync cnpm
  if (syncCnpm) {
    await sync(publishPkgNames)
  }
}

async function init(cwd: string) {
  const rootPkgJSONPath = path.join(cwd, 'package.json')

  if (!existsSync(rootPkgJSONPath)) {
    logger.printErrorAndExit(
      `unable to find the ${rootPkgJSONPath} file, make sure execute the command in the root directory.`,
    )
  }

  const rootPkgJSON: PkgJSON =
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require(rootPkgJSONPath)

  if (!rootPkgJSON.version) {
    logger.printErrorAndExit(
      `can not read version field in ${rootPkgJSONPath}.`,
    )
  }

  const monorepo = isMonorepo(cwd)
  const pkgJSONPaths: string[] = []
  const pkgJSONs: PkgJSON[] = []
  const pkgNames: string[] = []
  const publishPkgDirs: string[] = []
  const publishPkgNames: string[] = []

  if (monorepo) {
    const pkgPaths = getPkgPaths(cwd)

    try {
      await run(`pnpm -v`)
    } catch (err) {
      logger.printErrorAndExit(
        'monorepo release depend on `pnpm`, please install `pnpm` first.',
      )
    }

    pkgPaths.forEach(pkgPath => {
      const pkgDir = path.join(cwd, pkgPath)
      const pkgJSONPath = path.join(pkgDir, 'package.json')
      const pkgJSON: PkgJSON = readJSONSync(pkgJSONPath)

      if (!pkgJSON.name || !pkgJSON.version) {
        logger.warn(
          `skip publish ${chalk.cyanBright(
            pkgPath,
          )} cause the package.json is not valid.`,
        )
        return
      } else {
        pkgJSONPaths.push(pkgJSONPath)
        pkgJSONs.push(pkgJSON)
        pkgNames.push(pkgJSON.name)
      }

      if (!pkgJSON.private) {
        publishPkgDirs.push(pkgDir)
        publishPkgNames.push(pkgJSON.name as string)
      }
    })

    if (publishPkgNames.length === 0) {
      logger.warn(
        `the monorepo ${chalk.bold.cyanBright(cwd)} has no published package.`,
      )
      process.exit(0)
    }
  } else {
    if (rootPkgJSON.private) {
      logger.printErrorAndExit(
        `can not publish private package ${rootPkgJSONPath}.`,
      )
    }

    if (!rootPkgJSON.name) {
      logger.printErrorAndExit(`can not read name field in ${rootPkgJSONPath}.`)
    }

    pkgNames.push(rootPkgJSON.name as string)
    pkgJSONPaths.push(rootPkgJSONPath)
    pkgJSONs.push(rootPkgJSON)
    publishPkgDirs.push(cwd)
    publishPkgNames.push(rootPkgJSON.name as string)
  }

  return {
    rootPkgJSONPath: rootPkgJSONPath,
    rootPkgJSON: rootPkgJSON as Required<PkgJSON>,
    monorepo,
    pkgNames,
    pkgJSONPaths,
    pkgJSONs: pkgJSONs as Required<PkgJSON>[],
    publishPkgDirs,
    publishPkgNames,
  }
}

async function gitCheck() {
  step('Checking git ...')

  const isGitClean = (await run(`git status --porcelain`)).stdout.length

  if (isGitClean) {
    logger.printErrorAndExit('git status is not clean.')
  }

  await run('git fetch')
  const gitStatus = (await run('git status --short --branch')).stdout.trim()

  if (gitStatus.includes('behind')) {
    logger.printErrorAndExit('git status is behind remote.')
  }
}

async function registryCheck(opts: {
  repoType: string
  repoUrl?: string
  pkgRegistry?: string
}) {
  const { repoType, repoUrl, pkgRegistry } = opts

  step('Checking registry ...')
  let registry = ''

  if (repoType === 'github') {
    if (repoUrl) {
      try {
        new URL(repoUrl)
      } catch {
        logger.printErrorAndExit(`github repo url is invalid: ${repoUrl}.`)
      }
    }

    registry = 'https://registry.npmjs.org'
  } else if (pkgRegistry) {
    try {
      const url = new URL(pkgRegistry)
      registry = url.origin
    } catch {
      // ...
    }
  }

  if (registry) {
    const userRegistry = (await run(`npm config get registry`)).stdout.trim()

    if (!userRegistry.includes(registry)) {
      logger.printErrorAndExit(`npm registry is not ${chalk.blue(registry)}`)
    }
  }
}

async function ownershipCheck(publishPkgNames: string[]) {
  step('Checking npm ownership ...')

  const whoami = (await run('npm whoami')).stdout.trim()

  for (const pkgName of publishPkgNames) {
    try {
      const owners = (await run(`npm owner ls ${pkgName}`)).stdout
        .trim()
        .split('\n')
        .map(line => line.split(' ')[0])

      if (!owners.includes(whoami)) {
        logger.printErrorAndExit(`${pkgName} is not owned by ${whoami}.`)
      }
    } catch (err) {
      if ((err as Error).message.indexOf('Not Found') > -1) {
        continue
      }

      logger.error(`${pkgName} ownership is invalid.`)
      throw new Error((err as Error).message)
    }
  }
}

interface ReconfirmOpts {
  targetVersion: string
  publishPkgNames: string[]
  pkgJSON: Required<PkgJSON>
  monorepo: boolean
  tag?: PublishTag
  verbose?: boolean
}

async function reconfirm(opts: ReconfirmOpts): Promise<string> {
  const { targetVersion, publishPkgNames, pkgJSON, monorepo, tag, verbose } =
    opts
  let confirmMessage = ''

  if (publishPkgNames.length === 1 || !verbose) {
    confirmMessage = `Are you sure to bump ${chalk.cyanBright(targetVersion)}`
  } else {
    console.log(chalk.bold('The package will bump is as follows:'))
    publishPkgNames.forEach(pkgName =>
      console.log(` - ${chalk.cyanBright(`${pkgName}@${targetVersion}`)}`),
    )
    confirmMessage = 'Are you sure to bump?'
  }

  const answer = await confirm(confirmMessage)

  if (answer) {
    return targetVersion
  } else {
    const version = await getTargetVersion({
      pkgJSON,
      publishPkgNames: monorepo ? publishPkgNames : [pkgJSON.name],
      tag,
    })
    return reconfirm({
      ...opts,
      targetVersion: version,
    })
  }
}

async function commit(version: string) {
  step('Committing changes ...')
  // await run(
  //   `git commit --all --message chore:\\ bump\\ version\\ v${targetVersion}`,
  // )
  await execa('git', [
    'commit',
    '--all',
    '--message',
    `chore: bump version v${version}`,
  ])

  step('Pushing to git remote ...')
  await run(`git tag v${version}`)
  const branch = (await run(`git rev-parse --abbrev-ref HEAD`)).stdout.replace(
    /\n|\r|\t/,
    '',
  )
  await run(`git push --set-upstream origin ${branch} --tags`)
}

async function publish(opts: {
  version: string
  publishPkgDirs: string[]
  publishPkgNames: string[]
  changelog: string
  tag?: PublishTag
  gitChecks?: boolean
  repoType: string
  repoUrl?: string
  githubRelease?: boolean
}) {
  const {
    version,
    publishPkgDirs,
    publishPkgNames,
    changelog,
    tag,
    gitChecks,
    repoType,
    repoUrl,
    githubRelease,
  } = opts
  const isPnpm = publishPkgDirs.length > 1
  let publishTag: PublishTag | undefined

  if (tag) {
    publishTag = tag
  } else if (isAlphaVersion(version)) {
    publishTag = 'alpha'
  } else if (isBetaVersion(version)) {
    publishTag = 'beta'
  } else if (isRcVersion(version)) {
    publishTag = 'next'
  }

  step(`Publishing package ...`)
  const errors: string[] = []
  for (let i = 0; i < publishPkgDirs.length; i++) {
    const pkgDir = publishPkgDirs[i]
    const pkgName = publishPkgNames[i]

    try {
      await publishPackage(pkgDir, pkgName, version, publishTag)
    } catch (error) {
      errors.push(pkgName)
    }
  }

  if (errors.length > 0) {
    for (const pkgName of errors) {
      logger.error(
        `Published ${chalk.cyanBright.bold(`${pkgName}@${version}`)} failed.`,
      )
    }
  }

  // github release
  if (githubRelease && repoType === 'github' && repoUrl) {
    const url = await githubReleaseUrl({
      repoUrl,
      tag: `v${version}`,
      body: changelog,
      isPrerelease: isPrerelease(version),
    })

    await open(url)
  }

  async function publishPackage(
    pkgDir: string,
    pkgName: string,
    version: string,
    publishTag?: PublishTag,
  ) {
    const cmd = isPnpm ? 'pnpm' : 'npm'
    const tag = publishTag ? ['--tag', publishTag] : []

    const cliArgs = [
      'publish',
      ...tag,
      '--access',
      'public',
      isPnpm && !gitChecks ? '--no-git-checks' : '',
    ].filter(Boolean)

    await execa(cmd, cliArgs, {
      cwd: pkgDir,
    })

    logger.done(
      `Published ${chalk.cyanBright.bold(
        `${pkgName}@${version}`,
      )} successfully.`,
    )
  }
}

async function sync(publishPkgNames: string[]) {
  const cnpm = resolveBin.sync('cnpm')

  step('Sync cnpm ...')
  for (const pkgName of publishPkgNames) {
    await run(`${cnpm} sync ${pkgName}`, {
      verbose: false,
    })
    logger.done(`Sync ${chalk.cyanBright.bold(`${pkgName}`)} to cnpm.`)
  }
}
