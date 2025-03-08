import type { Api } from '@/types'

export default (api: Api) => {
  ;[
    'addQuestions',
    'modifyAppData',
    'modifyPrompts',
    'modifyTSConfig',
    'modifyJestConfig',
    'modifyPrettierConfig',
    'onBeforeGenerateFiles',
    'onCheck',
    'onStart',
    'onGenerateFiles',
    'onGenerateDone',
  ].forEach(name => {
    api.registerMethod(name)
  })
}
