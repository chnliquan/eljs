import { hasGit, hasProjectGit, logger, run } from '@eljs/utils'

import type { Api } from '../../types/index.js'

export default async (api: Api) => {
  api.describe({
    enable() {
      return Boolean(api.config.gitInit)
    },
  })

  async function shouldInitGit() {
    if (!(await hasGit())) {
      return false
    }

    if (await hasProjectGit(api.paths.target)) {
      return false
    }

    // 终端输入 no git
    if (api.prompts.git === false || api.prompts.git === 'false') {
      return false
    }

    return true
  }

  api.onGenerateDone(
    async () => {
      const initGit = await shouldInitGit()

      if (initGit) {
        console.log()
        logger.info(`🗃  Initializing git repository ...`)

        await run('git', ['init'], {
          cwd: api.paths.target,
          verbose: false,
        })
      }
    },
    {
      stage: Number.NEGATIVE_INFINITY,
    },
  )
}
