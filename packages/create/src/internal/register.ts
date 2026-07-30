import type { Api } from '../types/index.js'

export default (api: Api) => {
  ;[
    'modifyPaths',
    'modifyAppData',
    'addQuestions',
    'modifyPrompts',
    'modifyTsConfig',
    'modifyJestConfig',
    'modifyPrettierConfig',
    'onBeforeGenerateFiles',
    'onStart',
    'onGenerateFiles',
    'onGenerateDone',
  ].forEach(name => {
    api.registerMethod(name)
  })
}
