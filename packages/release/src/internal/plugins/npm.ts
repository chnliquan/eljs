import { normalizeArgs, run } from '@eljs/utils/cp'
import { chalk, logger } from '@eljs/utils/logger'
import { getNpmUser } from '@eljs/utils/npm'
import { definePlugin } from '../../define'
import type { AppData } from '../../types'
import { AppError, ReleasePublishError } from '../../utils'
import { mapWithConcurrency } from '../concurrency'
import { closeRollbackWindow } from '../precommit-rollback'
import {
  createPublishPlan,
  inspectPublishPlan,
  type PublishTarget,
} from '../publish-plan'
import { createSafeCommandError } from '../safe-command-error'

/**
 * 文件写入前完成校验并绑定目标版本的发布计划
 *
 * @remarks
 * 快照固定包名和目录映射，Hook 完成后及每次发布前只读复检实际清单
 */
interface PreparedPublishPlan {
  readonly version: string
  readonly workspacePackages: AppData['workspacePackages']
}

export default definePlugin(context => {
  let preparedPlan: PreparedPublishPlan | undefined

  function preparePublishPlan(version: string): PublishTarget[] {
    context.step('Preflighting package manifests ...')
    return createPublishPlan(context.appData, version)
  }

  context.onCheck(async () => {
    validatePublishArgs(normalizeArgs(context.config.npm.publishArgs))
    const { requireOwner } = context.config.npm

    if (requireOwner) {
      context.step('Checking npm owner ...')

      const { registry } = context.appData
      const registryArgs = registry ? ['--registry', registry] : []
      let user: string
      try {
        user = registry
          ? (
              await run('npm', ['whoami', ...registryArgs], {
                cwd: context.cwd,
                signal: context.signal,
              })
            ).stdout.trim()
          : await getNpmUser({
              cwd: context.cwd,
              signal: context.signal,
            })

        await mapWithConcurrency(
          context.appData.workspacePackages
            .filter(({ manifest }) => !manifest.private)
            .map(({ manifest }) => manifest.name),
          context.config.npm.networkConcurrency,
          checkPackageOwner,
        )
      } catch (error) {
        if (error instanceof AppError) throw error
        // whoami 和 owner 错误也可能包含 registry 用户信息，不能把底层异常交给外层日志
        throw createSafeCommandError(error, context.signal?.aborted)
      }

      async function checkPackageOwner(pkgName: string): Promise<void> {
        try {
          const owners = (
            await run('npm', ['owner', 'ls', pkgName, ...registryArgs], {
              cwd: context.cwd,
              signal: context.signal,
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
      validatePublishArgs(normalizeArgs(context.config.npm.publishArgs))
      preparePublishPlan(version)
      preparedPlan = {
        version,
        workspacePackages: structuredClone(context.appData.workspacePackages),
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

      const expected =
        preparedPlan?.version === version
          ? preparedPlan.workspacePackages
          : structuredClone(context.appData.workspacePackages)
      const targets = context.config.dryRun
        ? preparePublishPlan(version)
        : await inspectPublishPlan(context.appData, expected, version)
      validatePublishArgs(normalizeArgs(context.config.npm.publishArgs))
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
          // 前一个包的生命周期脚本可能改写后续产物，命令启动前重新核对完整图与顺序
          const current = await inspectPublishPlan(
            context.appData,
            expected,
            version,
          )
          if (
            current.map(pkg => pkg.name).join('\0') !==
            targets.map(pkg => pkg.name).join('\0')
          ) {
            throw new AppError(
              'Publish preflight failed: dependency order changed during publishing.',
            )
          }
          await publishPackage(target.rootPath, target.name, version)
          publishedPackages.push(target.name)
        } catch (error) {
          const publishError = new ReleasePublishError(
            {
              failedPackage: target.name,
              version,
              publishedPackages,
              unpublishedPackages: pendingTargets
                .slice(index)
                .map(({ name }) => name),
            },
            createSafeCommandError(error, context.signal?.aborted),
          )
          logger.error(publishError.message)
          throw publishError
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

        const publishArgs = normalizeArgs(context.config.npm.publishArgs)
        validatePublishArgs(publishArgs)
        const cliArgs = [
          ...(packageManagerVariant === 'yarn-berry'
            ? ['npm', 'publish']
            : ['publish']),
          ...tagArg,
          ...registryArg,
          ...pnpmGitCheckArg,
          ...publishArgs,
        ].filter(Boolean)

        // 命令失败也可能已在 registry 生效，从实际发布入口起保留目标版本供重试
        context.signal?.throwIfAborted()
        closeRollbackWindow(context.appData)
        await run(packageManager, cliArgs, {
          cwd: pkgRootPath,
          ...(publishEnv ? { env: publishEnv } : {}),
          // 凭据可能位于 OTP 参数或 registry URL；输出留在管道中，失败时只暴露白名单诊断
          verbose: false,
          stdout: 'pipe',
          stderr: 'pipe',
          stdin: 'inherit',
          signal: context.signal,
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

  context.onRelease(
    async ({ version }) => {
      validatePublishArgs(normalizeArgs(context.config.npm.publishArgs))
      if (context.config.dryRun) return
      const expected =
        preparedPlan?.version === version
          ? preparedPlan.workspacePackages
          : structuredClone(context.appData.workspacePackages)
      await inspectPublishPlan(context.appData, expected, version)
    },
    {
      // onBeforeRelease 的所有 Hook 已完成，实际产物检查必须先于 Git 的 stage -10
      stage: -20,
    },
  )
})

/**
 * 拒绝会绕过目录、版本和 registry 预检的发布参数
 *
 * @remarks
 * 附加参数仅允许选项，已知取值选项可使用分离值；未知选项使用等号形式
 * 目录、工作区及 registry 限制同时检查规范化名称，防止多横线或否定形式绕过
 * 会改变目标的已知别名与唯一缩写一并拒绝，不改写传给包管理器的原始参数
 * @throws 位置参数、目录切换、版本改写、registry 覆盖或配置来源切换参数出现时抛出
 */
function validatePublishArgs(args: string[]): void {
  const valueOptions = new Set([
    '--access',
    '--tag',
    '--otp',
    '--publish-branch',
    '--provenance-file',
  ])
  const forbiddenOptions = new Set([
    '--cwd',
    '--dir',
    '--directory',
    '--prefix',
    '--new-version',
    '--workspace',
    '--workspaces',
    '--workspace-root',
    '--workspace-packages',
    '--include-workspace-root',
    '--filter',
    '--filter-prod',
    '--recursive',
    // npm 将长形式 --C、--w、--ws、--iwr 及唯一缩写 --prefi、--i 展开为目标选项
    '--c',
    '--w',
    '--ws',
    '--iwr',
    '--prefi',
    '--i',
    // pnpm 的递归别名也不能改变已预检的单包发布范围
    '--r',
  ])
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    // npm 接受多横线和否定形式，目标与 registry 限制必须共用规范化名称
    const option = arg
      .split('=')[0]
      .toLowerCase()
      .replaceAll('_', '-')
      .replace(/^-+/, '--')
      .replace(/^--(?:no-)+/, '--')
    if (
      /^--reg(?:i(?:s(?:t(?:r(?:y)?)?)?)?)?$/.test(option) ||
      /^--(?:@[^:]+:registry|npm-(?:publish-)?registry|registry-url)$/.test(
        option,
      ) ||
      /^--(?:config(?:\.|$)|user-?config$|userc(?:o(?:n(?:f(?:i(?:g)?)?)?)?)?$|global-?config$|globalc(?:o(?:n(?:f(?:i(?:g)?)?)?)?)?$|use-yarnrc$|global$|sco(?:p(?:e)?)?$)/.test(
        option,
      ) ||
      option === '--g'
    ) {
      throw new AppError(
        'Publish preflight failed: registry configuration overrides are not allowed; configure npm.registry instead.',
      )
    }
    if (
      !arg.startsWith('-') ||
      arg === '--' ||
      forbiddenOptions.has(option) ||
      // pnpm 的 -F 是过滤选项，npm 的小写 -f 是 force，不能通过小写规范化混为一项
      /^-+(?:no-)*F(?:=|$)/.test(arg) ||
      // npm 接受从 include-w 起的唯一长选项缩写，禁止其选择工作区根包
      (option.startsWith('--include-w') &&
        '--include-workspace-root'.startsWith(option)) ||
      /^-[^-].+/.test(arg)
    ) {
      throw new AppError(
        'Publish preflight failed: publish arguments may change the validated target.',
      )
    }
    if (valueOptions.has(arg)) {
      if (!args[index + 1] || args[index + 1].startsWith('-'))
        throw new AppError(
          `Publish preflight failed: missing value for ${arg}.`,
        )
      index++
    }
  }
}
