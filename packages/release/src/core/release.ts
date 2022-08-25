import {
  chalk,
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
import { URL } from 'url'

import { getTargetVersion } from '../prompt'
import { Options } from '../types'
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
  const { cwd = process.cwd() } = opts

  const { pkgJSON, pkgPaths } = await init(cwd)

  const defaultOptions: Options = {
    gitChecks: true,
    syncCnpm: false,
    repoUrl: pkgJSON?.repository?.url || '',
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

  // check registry
  await registryCheck({
    repoType,
    repoUrl,
    pkgRegistry: pkgJSON?.publishConfig?.registry,
  })

  // bump version
  step('Bump version ...')
  const targetVersion = await getTargetVersion({
    pkgJSON: pkgJSON as Required<PkgJSON>,
    isMonorepo: pkgPaths.length > 0,
    customVersion,
  })

  if (typeof beforeUpdateVersion === 'function') {
    await beforeUpdateVersion(targetVersion)
  }

  // update all package versions and inter-dependencies
  step('Updating versions ...')
  const publishPkgInfo = updateVersions({
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
    pkgName: pkgJSON.name as string,
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
    await sync(publishPkgInfo?.publishPkgNames || [pkgJSON.name as string])
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
    pkgJSONPath,
    pkgJSON,
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

  // TODO: check ownership
  // step('Checking npm ownership ...')
  // const whoami = (await run('npm whoami')).stdout.trim()
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
  try {
    await run(`cnpm -v`)
  } catch (err) {
    logger.printErrorAndExit(
      'sync cnpm need install `cnpm` first or you can sync manually by https://npmmirror.com/sync/<package-name>.',
    )
  }

  step('Sync cnpm ...')
  for (const pkgName of publishPkgNames) {
    await run(`cnpm sync ${pkgName}`)
  }
}
