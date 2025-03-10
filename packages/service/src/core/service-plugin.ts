import { PluginApi } from './plugin-api'

export default (api: PluginApi) => {
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
