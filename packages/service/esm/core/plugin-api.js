function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }
function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }
function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : String(i); }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
import { PluginType, ServiceStage } from "../types";
import { isPlainObject, isString } from '@eljs/utils';
import assert from 'assert';
import { EnableBy } from "../enum";
import { Command } from "./command";
import { Hook } from "./hook";
import { Plugin } from "./plugin";
var resolveConfigModes = ['strict', 'loose'];
export var PluginAPI = /*#__PURE__*/function () {
  function PluginAPI(opts) {
    _classCallCheck(this, PluginAPI);
    _defineProperty(this, "service", void 0);
    _defineProperty(this, "plugin", void 0);
    this.service = opts.service;
    this.plugin = opts.plugin;
  }
  _createClass(PluginAPI, [{
    key: "describe",
    value: function describe(opts) {
      this.plugin.merge(opts);
    }
  }, {
    key: "registerCommand",
    value: function registerCommand(opts) {
      var _this = this;
      var alias = opts.alias;
      Reflect.deleteProperty(opts, 'alias');
      var registerCommand = function registerCommand(commandOpts) {
        var _this$service$command;
        var name = commandOpts.name,
          configResolveMode = commandOpts.configResolveMode;
        assert(!configResolveMode || resolveConfigModes.indexOf(configResolveMode) >= 0, "configResolveMode must be one of ".concat(resolveConfigModes.join(','), ", but got ").concat(configResolveMode));
        assert(!_this.service.commands[name], "api.registerCommand() failed, the command ".concat(name, " is exists from ").concat((_this$service$command = _this.service.commands[name]) === null || _this$service$command === void 0 ? void 0 : _this$service$command.plugin.id, "."));
        _this.service.commands[name] = new Command(_objectSpread(_objectSpread({}, commandOpts), {}, {
          plugin: _this.plugin
        }));
      };
      registerCommand(opts);
      if (alias) {
        var aliases = Array.isArray(alias) ? alias : [alias];
        aliases.forEach(function (alias) {
          registerCommand(_objectSpread(_objectSpread({}, opts), {}, {
            name: alias
          }));
        });
      }
    }
  }, {
    key: "registerGenerator",
    value: function registerGenerator(opts) {
      var _this$service$generat;
      var key = opts.key;
      assert(!this.service.generators[key], "api.registerGenerator() failed, the generator ".concat(key, " is exists from ").concat((_this$service$generat = this.service.generators[key]) === null || _this$service$generat === void 0 ? void 0 : _this$service$generat.plugin.id, "."));
      this.service.generators[key] = _objectSpread(_objectSpread({}, opts), {}, {
        plugin: this.plugin
      });
    }
  }, {
    key: "register",
    value: function register(opts) {
      var _this$service$hooks, _opts$key;
      (_this$service$hooks = this.service.hooks)[_opts$key = opts.key] || (_this$service$hooks[_opts$key] = []);
      this.service.hooks[opts.key].push(new Hook(_objectSpread(_objectSpread({}, opts), {}, {
        plugin: this.plugin
      })));
    }
  }, {
    key: "registerMethod",
    value: function registerMethod(opts) {
      assert(!this.service.pluginMethods[opts.name], "api.registerMethod() failed, method ".concat(opts.name, " is already exist."));
      this.service.pluginMethods[opts.name] = {
        plugin: this.plugin,
        fn: opts.fn ||
        // 这里不能用 arrow function，this 需指向执行此方法的 PluginAPI
        // 否则 pluginId 会不对，导致不能正确 skip plugin
        function fn(fn) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          this.register(_objectSpread({
            key: opts.name
          }, isPlainObject(fn) ? fn : {
            fn: fn
          }));
        }
      };
    }
  }, {
    key: "registerPresets",
    value: function registerPresets(source, prefix, presets) {
      var _this2 = this;
      assert(this.service.stage === ServiceStage.InitPresets, "api.registerPresets() failed, it should only used in presets stage.");
      var plugins = presets.map(function (preset) {
        return new Plugin({
          path: preset,
          cwd: _this2.service.cwd,
          type: PluginType.Plugin,
          prefix: prefix
        });
      });
      source.unshift.apply(source, _toConsumableArray(plugins));
    }
  }, {
    key: "registerPlugins",
    value: function registerPlugins(source, prefix, plugins) {
      var _this3 = this;
      assert(this.service.stage === ServiceStage.InitPresets || this.service.stage === ServiceStage.InitPlugins, "api.registerPlugins() failed, it should only be used in registering stage.");
      var mappedPlugins = plugins.map(function (plugin) {
        if (isString(plugin)) {
          return new Plugin({
            path: plugin,
            cwd: _this3.service.cwd,
            type: PluginType.Plugin,
            prefix: prefix
          });
        } else {
          assert(plugin.id && plugin.key, "Invalid plugin object, id and key must supplied.");
          plugin.type = PluginType.Plugin;
          plugin.enableBy = plugin.enableBy || EnableBy.Register;
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          plugin.apply = plugin.apply || function () {
            return function () {};
          };
          return plugin;
        }
      });
      if (this.service.stage === ServiceStage.InitPresets) {
        source.push.apply(source, _toConsumableArray(mappedPlugins));
      } else {
        source.unshift.apply(source, _toConsumableArray(mappedPlugins));
      }
    }
  }, {
    key: "skipPlugins",
    value: function skipPlugins(keys) {
      var _this4 = this;
      keys.forEach(function (key) {
        assert(!(_this4.plugin.key === key), "plugin ".concat(key, " can't skip itself!"));
        assert(_this4.service.keyToPluginMap[key], "key: ".concat(key, " is not be registered by any plugin. You can't skip it!"));
        _this4.service.skipPluginIds.add(_this4.service.keyToPluginMap[key].id);
      });
    }
  }], [{
    key: "proxyPluginAPI",
    value: function proxyPluginAPI(opts) {
      return new Proxy(opts.pluginAPI, {
        get: function get(target, prop) {
          if (opts.service.pluginMethods[prop]) {
            return opts.service.pluginMethods[prop].fn;
          }
          if (opts.serviceProps.includes(prop)) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            var serviceProp = opts.service[prop];
            return typeof serviceProp === 'function' ? serviceProp.bind(opts.service) : serviceProp;
          }
          if (prop in opts.staticProps) {
            return opts.staticProps[prop];
          }
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          return target[prop];
        }
      });
    }
  }]);
  return PluginAPI;
}();