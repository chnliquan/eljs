import {
  chalk,
  confirm,
  execa,
  existsSync,
  logger,
  PkgJSON,
  readJSONSync,
  run,
} from '@eljs/utils'
import githubRelease from 'new-github-release-url'
import open from 'open'
import path from 'path'
import resolveBin from 'resolve-bin'
import { URL } from 'url'

import { getTargetVersion } from '../prompt'
import { Options } from '../types'
import { getPkgPaths, getPublishPkgInfo } from '../utils/pkg'
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
  const { cwd = process.cwd() } = opts

  const { rootPkgJSON, pkgPaths } = await init(cwd)

  const defaultOptions: Options = {
    gitChecks: true,
    syncCnpm: false,
    repoUrl: rootPkgJSON?.repository?.url || '',
    changelogPreset: '@eljs/changelog-preset',
    latest: true,
  }

  const {
    targetVersion: customVersion,
    gitChecks,
    syncCnpm,
    repoType: customRepoType,
    repoUrl,
    changelogPreset,
    latest,
    beforeUpdateVersion,
    beforeChangelog,
  } = Object.assign(defaultOptions, opts)
  const repoType =
    customRepoType || (repoUrl?.includes('github') ? 'github' : 'gitlab')

  // check git status
  await gitCheck(gitChecks)

  const publishPkgInfo = getPublishPkgInfo({
    cwd,
    rootPkgJSON,
    pkgPaths,
  })

  // check registry
  await registryCheck({
    repoType,
    repoUrl,
    pkgRegistry: rootPkgJSON?.publishConfig?.registry,
  })

  // bump version
  step('Bump version ...')
  const targetVersion = await getTargetVersion({
    pkgJSON: rootPkgJSON,
    isMonorepo: pkgPaths.length > 0,
    customVersion,
  })

  if (!customVersion) {
    await reconfirm(targetVersion, publishPkgInfo.publishPkgNames)
  }

  if (typeof beforeUpdateVersion === 'function') {
    await beforeUpdateVersion(targetVersion)
  }

  // update all package versions and inter-dependencies
  step('Updating versions ...')
  await updateVersions({
    rootDir: cwd,
    pkgPaths,
    version: targetVersion,
  })

  // update pnpm-lock.yaml or package-lock.json
  step('Updating lockfile...')
  await updateLock({
    isMonorepo: pkgPaths.length > 0,
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
    publishPkgDirs: publishPkgInfo?.publishPkgDirs || [cwd],
    gitChecks,
    changelog,
    repoType,
    repoUrl,
  })

  if (syncCnpm) {
    await sync(publishPkgInfo?.publishPkgNames || [rootPkgJSON.name as string])
  }
}

async function init(cwd: string) {
  const pkgJSONPath = path.join(cwd, 'package.json')

  if (!existsSync(pkgJSONPath)) {
    logger.printErrorAndExit(
      `unable to find the ${pkgJSONPath} file, make sure execute the command in the root directory.`,
    )
  }

  const pkgJSON: PkgJSON =
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require(pkgJSONPath)

  if (!pkgJSON.version) {
    logger.printErrorAndExit(`can not read version field in ${pkgJSONPath}.`)
  }

  const pkgPaths = getPkgPaths(cwd)

  if (pkgPaths.length > 0) {
    try {
      await run(`pnpm -v`)
    } catch (err) {
      logger.printErrorAndExit(
        'monorepo release depend on `pnpm`, please install `pnpm` first.',
      )
    }
  } else {
    if (!pkgJSON.name) {
      logger.printErrorAndExit(`can not read name field in ${pkgJSONPath}.`)
    }
  }

  return {
    rootPkgJSONPath: pkgJSONPath,
    rootPkgJSON: pkgJSON as Required<PkgJSON>,
    pkgPaths,
  }
}

async function gitCheck(gitChecks?: boolean) {
  step('Checking git ...')

  if (gitChecks) {
    const isGitClean = (await run(`git status --porcelain`)).stdout.length

    if (isGitClean) {
      logger.printErrorAndExit('git status is not clean.')
    }
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

  step('Checking npm ownership ...')
  const whoami = (await run('npm whoami')).stdout.trim()
  console.log('whoami', whoami)
  // await Promise.all(
  //   ['umi', '@umijs/core'].map(async pkg => {
  //     const owners = (await $`npm owner ls ${pkg}`).stdout
  //       .trim()
  //       .split('\n')
  //       .map(line => {
  //         return line.split(' ')[0]
  //       })
  //     assert(owners.includes(whoami), `${pkg} is not owned by ${whoami}`)
  //   }),
  // )
}

async function reconfirm(targetVersion: string, publishPkgNames: string[]) {
  let confirmMessage = ''

  if (publishPkgNames.length === 1) {
    confirmMessage = `Are you sure to bump ${chalk.greenBright(
      publishPkgNames[0],
    )} to ${chalk.cyanBright(targetVersion)}`
  } else {
    console.log(chalk.bold('The package will bump is as follows:'))
    publishPkgNames.forEach(pkgName =>
      console.log(` - ${chalk.cyanBright(`${pkgName}@${targetVersion}`)}`),
    )
    confirmMessage = 'Are you sure to bump?'
  }

  const answer = await confirm(confirmMessage)

  if (!answer) {
    logger.info('Cancel')
    process.exit(0)
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
  changelog: string
  gitChecks?: boolean
  repoType: string
  repoUrl?: string
}) {
  const { version, publishPkgDirs, changelog, gitChecks, repoType, repoUrl } =
    opts
  const isPnpm = publishPkgDirs.length > 1

  step(`Publishing package ...`)
  for (const pkgDir of publishPkgDirs) {
    await publishPackage(pkgDir, version)
  }

  // github release
  if (repoType === 'github' && repoUrl) {
    const url = await githubRelease({
      repoUrl,
      tag: `v${version}`,
      body: changelog,
      isPrerelease: isPrerelease(version),
    })

    await open(url)
  }

  async function publishPackage(pkgDir: string, targetVersion: string) {
    const pkgJSON = readJSONSync(path.join(pkgDir, 'package.json'))
    let releaseTag = ''

    if (isRcVersion(targetVersion)) {
      releaseTag = 'next'
    } else if (isAlphaVersion(targetVersion)) {
      releaseTag = 'alpha'
    } else if (isBetaVersion(targetVersion)) {
      releaseTag = 'beta'
    }

    const cmd = isPnpm ? 'pnpm' : 'npm'
    const tag = releaseTag ? ['--tag', releaseTag] : []

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
        `${pkgJSON.name}@${targetVersion}`,
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
