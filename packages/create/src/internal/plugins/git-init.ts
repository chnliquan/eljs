import type { Api } from '@/types'
import { hasGit, hasProjectGit, logger, run } from '@eljs/utils'

export default async (api: Api) => {
  api.describe({
    enable() {
      return api.userConfig.gitInit === true
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

  api.register(
    'onGenerateDone',
    async () => {
      const initGit = await shouldInitGit()

      if (initGit) {
        console.log()
        logger.info(`🗃 Initializing git repository...`)
        run('git', ['init'], {
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
