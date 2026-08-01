import { chalk, getNpmUser, logger, normalizeArgs, run } from '@eljs/utils'
import { definePlugin } from '../../define'
import { AppError, ReleasePublishError } from '../../utils'
import { mapWithConcurrency } from '../concurrency'
import { createPublishPlan, type PublishTarget } from '../publish-plan'

/**
 * 文件写入前完成校验并绑定目标版本的发布计划
 *
 * @remarks
 * 计划仅能复用于同一目标版本，避免发布阶段重新读取已发生变化的清单映射
 */
interface PreparedPublishPlan {
  readonly targets: PublishTarget[]
  readonly version: string
}

export default definePlugin(context => {
  let preparedPlan: PreparedPublishPlan | undefined

  function preparePublishPlan(version: string): PublishTarget[] {
    context.step('Preflighting package manifests ...')
    return createPublishPlan(context.appData, version)
  }

  context.onCheck(async () => {
    const { requireOwner } = context.config.npm

    if (requireOwner) {
      context.step('Checking npm owner ...')

      const { registry } = context.appData
      const registryArgs = registry ? ['--registry', registry] : []
      const user = registry
        ? (
            await run('npm', ['whoami', ...registryArgs], {
              cwd: context.cwd,
            })
          ).stdout.trim()
        : await getNpmUser({
            cwd: context.cwd,
          })

      await mapWithConcurrency(
        context.appData.validPkgNames,
        context.config.npm.networkConcurrency,
        checkPackageOwner,
      )

      async function checkPackageOwner(pkgName: string): Promise<void> {
        try {
          const owners = (
            await run('npm', ['owner', 'ls', pkgName, ...registryArgs], {
              cwd: context.cwd,
            })
          ).stdout
            .trim()
            .split(/\r?\n/)
            .map(line => line.split(' ')?.[0])

          if (!owners?.includes(user)) {
            throw new AppError(
              `User ${chalk.cyan(user)} is not the owner of \`${pkgName}\`.`,
            )
          }
        } catch (error) {
          const err = error as Error

          if (
            /\bE404\b/i.test(err.message) ||
            /404 Not Found/i.test(err.message) ||
            /is not in this registry/i.test(err.message)
          ) {
            return
          }

          throw err
        }
      }
    }
  })

  context.onBeforeBumpVersion(
    ({ version }) => {
      preparedPlan = {
        targets: preparePublishPlan(version),
        version,
      }
    },
    {
      // version 插件先生成内存清单，发布预检通过后才允许进入文件写入阶段
      stage: 10,
    },
  )

  context.onRelease(
    async ({ version, isPrerelease, prereleaseId }) => {
      const { branch, packageManager, packageManagerVariant, registry } =
        context.appData

      const targets =
        preparedPlan?.version === version
          ? preparedPlan.targets
          : preparePublishPlan(version)
      const existingPkgNames = new Set<string>(
        context.appData.existingPkgNames ?? [],
      )
      const pendingTargets = targets.filter(target => {
        if (!existingPkgNames.has(target.name)) {
          return true
        }

        logger.warn(
          `Skipping already published ${chalk.cyan(`${target.name}@${version}`)}.`,
        )
        return false
      })

      if (context.config.dryRun) {
        for (const target of pendingTargets) {
          logger.info(
            `Would publish ${chalk.cyan(`${target.name}@${version}`)} from ${target.rootPath}.`,
          )
        }
        return
      }

      context.step('Publishing packages in dependency order ...')
      const publishedPackages: string[] = []

      for (let index = 0; index < pendingTargets.length; index++) {
        const target = pendingTargets[index]

        try {
          await publishPackage(target.rootPath, target.name, version)
          publishedPackages.push(target.name)
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error)

          console.log()
          logger.error(
            `Published ${chalk.cyan(`${target.name}@${version}`)} failed.`,
          )
          console.log(`Error: ${errorMessage}`)

          throw new ReleasePublishError(
            {
              failedPackage: target.name,
              version,
              publishedPackages,
              unpublishedPackages: pendingTargets
                .slice(index)
                .map(({ name }) => name),
            },
            error,
          )
        }
      }

      async function publishPackage(
        pkgRootPath: string,
        pkgName: string,
        version: string,
      ) {
        // 数字型或保留标识的预发布版本不能直接作为安全的 npm dist-tag
        const distTag = isPrerelease
          ? prereleaseId && prereleaseId !== 'latest'
            ? prereleaseId
            : 'next'
          : undefined
        const tagArg = distTag ? ['--tag', distTag] : []
        // Yarn Berry 通过配置项而非 CLI 参数选择发布 registry
        const registryArg =
          registry && packageManagerVariant !== 'yarn-berry'
            ? ['--registry', registry]
            : []
        const publishEnv =
          registry && packageManagerVariant === 'yarn-berry'
            ? { YARN_NPM_PUBLISH_REGISTRY: registry }
            : undefined
        const { requireBranch } = context.config.git
        const pnpmGitCheckArg =
          packageManager === 'pnpm'
            ? requireBranch
              ? ['--publish-branch', requireBranch]
              : ['master', 'main'].includes(branch)
                ? []
                : ['--no-git-checks']
            : []

        const cliArgs = [
          ...(packageManagerVariant === 'yarn-berry'
            ? ['npm', 'publish']
            : ['publish']),
          ...tagArg,
          ...registryArg,
          ...pnpmGitCheckArg,
          ...normalizeArgs(context.config.npm.publishArgs),
        ].filter(Boolean)

        await run(packageManager, cliArgs, {
          cwd: pkgRootPath,
          ...(publishEnv ? { env: publishEnv } : {}),
          verbose: true,
          stdin: 'inherit',
        })

        logger.ready(
          `Published ${chalk.bold.cyan(`${pkgName}@${version}`)} successfully.`,
        )
      }
    },
    {
      // Publish after the local release commit/tag, but before any remote push.
      stage: 0,
    },
  )
})
