import { PluginAPI } from './core/plugin-api'

export default (api: PluginAPI) => {
  ;['modifyPaths', 'modifyAppData', 'onCheck', 'onStart'].forEach(name => {
    api.registerMethod({ name })
  })
}
