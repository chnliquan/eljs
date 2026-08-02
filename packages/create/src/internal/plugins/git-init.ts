import { run } from '@eljs/utils/cp'
import { hasGit, hasProjectGit } from '@eljs/utils/git'
import { logger } from '@eljs/utils/logger'

import { definePlugin } from '../../define'

export default definePlugin(async context => {
  context.describe({
    enable() {
      return Boolean(context.config.gitInit)
    },
  })

  async function shouldInitGit() {
    throwIfAborted()

    if (!(await hasGit())) {
      return false
    }

    throwIfAborted()

    const projectHasGit = context.config.signal
      ? await hasProjectGit(context.paths.target, {
          signal: context.config.signal,
        })
      : await hasProjectGit(context.paths.target)

    if (projectHasGit) {
      return false
    }

    throwIfAborted()

    // 终端输入 no git
    if (context.prompts.git === false || context.prompts.git === 'false') {
      return false
    }

    return true
  }

  context.onGenerateDone(
    async () => {
      const initGit = await shouldInitGit()

      if (initGit) {
        console.log()
        logger.info(`🗃  Initializing git repository ...`)

        await run('git', ['init'], {
          cwd: context.paths.target,
          ...(context.config.signal ? { signal: context.config.signal } : {}),
          verbose: false,
        })
      }
    },
    {
      stage: Number.NEGATIVE_INFINITY,
    },
  )

  function throwIfAborted(): void {
    if (context.config.signal?.aborted) {
      throw context.config.signal.reason
    }
  }
})
