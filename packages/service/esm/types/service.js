export var ServiceStage = /*#__PURE__*/function (ServiceStage) {
  ServiceStage["Uninitialized"] = "uninitialized";
  ServiceStage["Init"] = "init";
  ServiceStage["InitPresets"] = "initPresets";
  ServiceStage["InitPlugins"] = "initPlugins";
  ServiceStage["CollectAppData"] = "collectAppData";
  ServiceStage["OnCheck"] = "onCheck";
  ServiceStage["OnStart"] = "onStart";
  ServiceStage["RunCommand"] = "runCommand";
  return ServiceStage;
}({});

/**
 * 预设插件提取器
 */

export var ApplyPluginsType = /*#__PURE__*/function (ApplyPluginsType) {
  ApplyPluginsType["Add"] = "add";
  ApplyPluginsType["Modify"] = "modify";
  ApplyPluginsType["Event"] = "event";
  return ApplyPluginsType;
}({});