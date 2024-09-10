import type { Api } from '@/types'

export default (api: Api) => {
  ;[
    'addQuestions',
    'modifyPrompts',
    'modifyTSConfig',
    'modifyJestConfig',
    'modifyPrettierConfig',
    'onBeforeGenerateFiles',
    'onGenerateFiles',
    'onGenerateDone',
  ].forEach(name => {
    api.registerMethod({ name })
  })
}
