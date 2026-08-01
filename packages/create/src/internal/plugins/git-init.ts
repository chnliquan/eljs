import { hasGit, hasProjectGit, logger, run } from '@eljs/utils'

import { definePlugin } from '../../define'

export default definePlugin(async context => {
  context.describe({
    enable() {
      return Boolean(context.config.gitInit)
    },
  })

  async function shouldInitGit() {
    if (!(await hasGit())) {
      return false
    }

    if (await hasProjectGit(context.paths.target)) {
      return false
    }

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
          verbose: false,
        })
      }
    },
    {
      stage: Number.NEGATIVE_INFINITY,
    },
  )
})
