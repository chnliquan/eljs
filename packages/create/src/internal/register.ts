import { Api } from '../types'

export default (api: Api) => {
  ;[
    'addQuestions',
    'modifyPrompts',
    'modifyTSConfig',
    'onBeforeGenerateFiles',
    'onGenerateFiles',
    'onGenerateDone',
  ].forEach(name => {
    api.registerMethod({ name })
  })
}
