import { Api } from '../types'

export default (api: Api) => {
  ;[
    'modifyConfig',
    'addQuestions',
    'onGenerateSchema',
    'modifyPrompts',
    'modifyPaths',
    'modifyAppData',
    'onCheck',
    'onStart',
    'onBeforeGenerateFiles',
    'onGenerateFiles',
    'onGenerateDone',
  ].forEach(name => {
    api.registerMethod({ name })
  })
}
