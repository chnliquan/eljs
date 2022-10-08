import { PluginAPI } from './plugin-api'

export default (api: PluginAPI) => {
  ;[
    'modifyPluginConfig',
    'modifyPaths',
    'modifyAppData',
    'onCheck',
    'onStart',
  ].forEach(name => {
    api.registerMethod({ name })
  })
}
