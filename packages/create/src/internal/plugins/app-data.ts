import type { Api, AppData } from '../../types'

export default (api: Api) => {
  api.modifyAppData(memo => {
    memo.packageManager = api.prompts
      .packageManager as AppData['packageManager']
    return memo
  })
}
