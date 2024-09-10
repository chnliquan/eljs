export default (function (api) {
  ;
  ['addQuestions', 'modifyPrompts', 'modifyTSConfig', 'modifyJestConfig', 'modifyPrettierConfig', 'onBeforeGenerateFiles', 'onGenerateFiles', 'onGenerateDone'].forEach(function (name) {
    api.registerMethod({
      name: name
    });
  });
});