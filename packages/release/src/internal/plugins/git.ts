import { normalizeArgs } from '@eljs/utils/cp'
import { pathExists, readFile, writeFileAtomic } from '@eljs/utils/file'
import {
  gitCommit,
  gitPush,
  gitTag,
  isGitBehindRemote,
  isGitClean,
} from '@eljs/utils/git'
import { chalk, logger } from '@eljs/utils/logger'
import { mkdir, rmdir } from 'node:fs/promises'
import { EOL } from 'node:os'
import path from 'node:path'

import { definePlugin } from '../../define'
import type { AppData } from '../../types'
import { AppError, getChangelog, isGitTagAtHead } from '../../utils'
import { resolveChangelogPath } from '../changelog-path'
import { captureFileSnapshots, restoreLockfiles } from '../lockfile-transaction'
import {
  closeRollbackWindow,
  registerPrecommitRollback,
  rollbackPrecommitChanges,
} from '../precommit-rollback'

export default definePlugin(context => {
  let rollbackData: AppData | undefined
  context.onError(async () => {
    if (rollbackData) await rollbackPrecommitChanges(rollbackData)
  })
  context.onAfterRelease(() => closeRollbackWindow(context.appData))
  context.onCheck(async () => {
    const { requireClean, requireBranch } = context.config.git

    if (requireClean) {
      context.step('Checking git ...')

      if (
        !(await isGitClean({
          cwd: context.cwd,
          signal: context.signal,
          verbose: true,
        }))
      ) {
        throw new AppError('Git working tree is not clean.')
      }

      if (
        await isGitBehindRemote({
          cwd: context.cwd,
          signal: context.signal,
          verbose: true,
        })
      ) {
        throw new AppError('Git working tree is behind remote.')
      }
    }

    if (requireBranch && context.appData.branch !== requireBranch) {
      throw new AppError(
        `Required branch ${chalk.cyan(requireBranch)}, but got ${chalk.cyan(context.appData.branch)}.`,
      )
    }
  })

  context.getChangelog(
    async () => {
      const { changelog, independent } = context.config.git

      if (!changelog) {
        return ''
      }

      return getChangelog({
        cwd: context.cwd,
        independent,
        ...changelog,
        signal: context.signal,
      })
    },
    {
      stage: 10,
    },
  )

  context.onBeforeRelease(async ({ changelog }) => {
    if (
      !changelog ||
      !context.config.git.changelog ||
      context.appData.isReleaseRetry ||
      context.appData.existingPkgNames?.length
    ) {
      return
    }

    const { filename, placeholder } = context.config.git.changelog
    // 配置路径先通过边界与 Git 元数据检查，读取旧日志也不能跟随子路径链接
    const changelogFile = await resolveChangelogPath(
      context.cwd,
      filename,
      context.signal,
    )

    context.step(`Writing changelog to ${changelogFile} ...`)

    if (context.config.dryRun) {
      return
    }

    if (changelog.indexOf('###') === -1) {
      changelog = `${changelog.trim()}${EOL}${EOL}${placeholder}`
    }

    if (await pathExists(changelogFile)) {
      const remain = (await readFile(changelogFile)).trim()
      const titlePattern = /^#\s+.+$/m

      if (!remain.length) {
        changelog = `# ChangeLog${EOL}${EOL}${changelog}`
      } else if (titlePattern.test(remain)) {
        changelog = remain.replace(
          titlePattern,
          title => `${title}${EOL}${EOL}${changelog}`,
        )
      } else {
        changelog = `# ChangeLog${EOL}${EOL}${changelog}${EOL}${EOL}${remain}`
      }
    } else {
      changelog = `# ChangeLog${EOL}${EOL}${changelog}`
    }

    const snapshot = await captureFileSnapshots([changelogFile])
    const createdDirectories: string[] = []
    rollbackData = context.appData
    registerPrecommitRollback(
      context.appData,
      async () => {
        const errors: unknown[] = []
        try {
          await restoreLockfiles(snapshot)
        } catch (error) {
          errors.push(error)
        }
        // 只删除本次新建且仍为空的目录，自定义 Hook 留下的文件必须保留
        for (const directory of [...createdDirectories].reverse()) {
          try {
            await rmdir(directory)
          } catch (error) {
            const code = (error as NodeJS.ErrnoException).code
            if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(code ?? '')) {
              errors.push(error)
            }
          }
        }
        if (errors.length) {
          throw new AggregateError(errors, 'Changelog rollback failed.')
        }
      },
      () => {
        rollbackData = undefined
      },
    )
    const missingDirectories: string[] = []
    let directory = path.dirname(changelogFile)
    while (directory !== context.cwd && !(await pathExists(directory))) {
      missingDirectories.unshift(directory)
      directory = path.dirname(directory)
    }
    for (const missing of missingDirectories) {
      await mkdir(missing)
      createdDirectories.push(missing)
    }
    await writeFileAtomic(
      await resolveChangelogPath(context.cwd, filename, context.signal),
      changelog,
    )
  })

  context.onRelease(
    async ({ version }) => {
      const { independent, commit, commitMessage, commitArgs } =
        context.config.git
      const publishablePackageNames = context.appData.workspacePackages
        .filter(({ manifest }) => !manifest.private)
        .map(({ manifest }) => manifest.name)

      if (!commit || context.config.dryRun) {
        return
      }

      const isRetry =
        context.appData.isReleaseRetry ||
        Boolean(context.appData.existingPkgNames?.length)
      if (!isRetry) {
        context.step('Committing changes ...')

        const commitMsg = commitMessage.replace('${version}', version)
        const args = normalizeArgs(commitArgs).filter(Boolean)
        // 信号已取消时仍可恢复；进入 gitCommit 后可能已产生真实提交，禁止回退
        context.signal?.throwIfAborted()
        closeRollbackWindow(context.appData)
        await gitCommit(commitMsg, args, {
          cwd: context.cwd,
          signal: context.signal,
          verbose: true,
        })
      }
      // 重试分支已有真实提交，补标签失败也必须保留当前版本
      if (isRetry) closeRollbackWindow(context.appData)

      const tags = independent
        ? publishablePackageNames.map(pkgName => `${pkgName}@${version}`)
        : [`v${version}`]

      for (const tagName of tags) {
        // 重试保留现有提交，只补缺失标签；非 HEAD 标签由非强制 gitTag 拒绝覆盖
        if (
          isRetry &&
          (await isGitTagAtHead(tagName, {
            cwd: context.cwd,
            signal: context.signal,
            verbose: false,
          }))
        ) {
          continue
        }
        try {
          await gitTag(tagName, {
            cwd: context.cwd,
            signal: context.signal,
            verbose: true,
          })
        } catch (error) {
          const err = error as Error
          const tagExists =
            /tag '.+' already exists/.test(err.message) ||
            /标签 '.+' 已存在/.test(err.message)

          if (
            tagExists &&
            (await isGitTagAtHead(tagName, {
              cwd: context.cwd,
              signal: context.signal,
              verbose: false,
            }))
          ) {
            logger.warn(`Tag ${chalk.cyan(tagName)} already exists.`)
          } else {
            throw err
          }
        }
      }
    },
    {
      // 所有包发布成功前保留本地提交和标签，便于中断后重试
      stage: -10,
    },
  )

  context.onRelease(
    async () => {
      const { commit, push, pushArgs } = context.config.git

      if (!commit || !push || context.config.dryRun) {
        return
      }

      context.step('Pushing release commit and tags ...')
      await gitPush([...normalizeArgs(pushArgs)].filter(Boolean), {
        cwd: context.cwd,
        signal: context.signal,
        verbose: true,
      })
    },
    {
      stage: 10,
    },
  )
})
