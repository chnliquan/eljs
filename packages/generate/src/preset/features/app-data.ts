import { Api } from '../../types'

export default (api: Api) => {
  api.modifyAppData(async memo => {
    memo.projectName = api.args.projectName || ''

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const version = require('../../../package.json').version

    memo.version = version
    memo.npmClient = api.prompts.npmClient || 'pnpm'

    return memo
  })
}
