import type { Api } from '@/types'

export default (api: Api) => {
  api.modifyAppData(async memo => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const version = require('../../../package.json').version
    memo.version = version
    memo.projectName = api.args.projectName || ''
    memo.packageManager = api.prompts.packageManager || 'pnpm'
    return memo
  })
}
