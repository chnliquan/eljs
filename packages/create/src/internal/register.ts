import { Api } from '../types'

export default (api: Api) => {
  ;[
    'addQuestions',
    'onGenerateSchema',
    'modifyPrompts',
    'onBeforeGenerateFiles',
    'onGenerateFiles',
    'onGenerateDone',
  ].forEach(name => {
    api.registerMethod({ name })
  })
}
