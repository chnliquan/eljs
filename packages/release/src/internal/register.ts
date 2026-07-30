import type { Api } from '../types/index.js'

export default (api: Api) => {
  ;[
    'modifyConfig',
    'modifyAppData',
    'onCheck',
    'onStart',
    'getIncrementVersion',
    'onBeforeBumpVersion',
    'onBumpVersion',
    'onAfterBumpVersion',
    'getChangelog',
    'onBeforeRelease',
    'onRelease',
    'onAfterRelease',
  ].forEach(name => {
    api.registerMethod(name)
  })
}
