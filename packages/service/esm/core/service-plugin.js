export default (function (api) {
  ;
  ['modifyPluginConfig', 'modifyPaths', 'modifyAppData', 'onCheck', 'onStart'].forEach(function (name) {
    api.registerMethod({
      name: name
    });
  });
});