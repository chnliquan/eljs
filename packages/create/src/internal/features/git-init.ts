import { Api } from '../../types'

export default async (api: Api) => {
  api.describe({
    enableBy() {
      return api.config.gitInit === true
    },
  })

  async function shouldInitGit() {
    const { hasGit, hasProjectGit } = api.utils

    if (!(await hasGit())) {
      return false
    }

    if (await hasProjectGit(api.paths.absOutputPath)) {
      return false
    }

    // 终端输入 no git
    if (api.prompts.git === false || api.prompts.git === 'false') {
      return false
    }

    return true
  }

  api.register({
    key: 'onGenerateDone',
    stage: Number.NEGATIVE_INFINITY,
    async fn() {
      const initGit = await shouldInitGit()

      if (initGit) {
        console.log()
        api.utils.logger.info(`🗃 Initializing git repository...`)
        api.utils.run('git init', {
          cwd: api.paths.absOutputPath,
        })
      }
    },
  })
}