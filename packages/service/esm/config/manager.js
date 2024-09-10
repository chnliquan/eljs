function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }
function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }
function _createForOfIteratorHelper(o, allowArrayLike) { var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"]; if (!it) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = it.call(o); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }
function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : String(i); }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
import { isPathExistsSync, register } from '@eljs/utils';
import assert from 'assert';
import deepMerge from 'deepmerge';
import esbuild from 'esbuild';
import joi from 'joi';
import { join } from 'path';
import { DEFAULT_CONFIG_FILES, LOCAL_EXT, SHORT_ENV } from "../const";
import { Env } from "../types/env";
import { addExt, getAbsFiles } from "./utils";
export var ConfigManager = /*#__PURE__*/function () {
  function ConfigManager(opts) {
    _classCallCheck(this, ConfigManager);
    _defineProperty(this, "opts", void 0);
    /**
     * 主配置文件地址
     */
    _defineProperty(this, "mainConfigFile", void 0);
    this.opts = opts;
    this.mainConfigFile = ConfigManager.getMainConfigFile(this.opts);
  }
  _createClass(ConfigManager, [{
    key: "getUserConfig",
    value: function getUserConfig() {
      var configFiles = ConfigManager.getConfigFiles({
        mainConfigFile: this.mainConfigFile,
        env: this.opts.env
      });
      return ConfigManager.getUserConfig({
        configFiles: getAbsFiles({
          files: configFiles,
          cwd: this.opts.cwd
        })
      });
    }
  }, {
    key: "getConfig",
    value: function getConfig(opts) {
      var _this$getUserConfig = this.getUserConfig(),
        config = _this$getUserConfig.config,
        files = _this$getUserConfig.files;
      ConfigManager.validateConfig({
        config: config,
        schemas: opts.schemas
      });
      return {
        config: config,
        files: files
      };
    }
  }], [{
    key: "getMainConfigFile",
    value: function getMainConfigFile(opts) {
      var mainConfigFile = null;
      var _iterator = _createForOfIteratorHelper(opts.defaultConfigFiles || DEFAULT_CONFIG_FILES),
        _step;
      try {
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          var configFile = _step.value;
          var absConfigFile = join(opts.cwd, configFile);
          if (isPathExistsSync(absConfigFile)) {
            mainConfigFile = absConfigFile;
            break;
          }
        }
      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }
      return mainConfigFile;
    }
  }, {
    key: "getConfigFiles",
    value: function getConfigFiles(opts) {
      var configFiles = [];
      var mainConfigFile = opts.mainConfigFile;
      if (mainConfigFile) {
        var env = SHORT_ENV[opts.env] || opts.env;
        configFiles.push.apply(configFiles, _toConsumableArray([mainConfigFile, env && addExt({
          file: mainConfigFile,
          ext: ".".concat(env)
        })].filter(Boolean)));
        if (opts.env === Env.development) {
          configFiles.push(addExt({
            file: mainConfigFile,
            ext: LOCAL_EXT
          }));
        }
      }
      return configFiles;
    }
  }, {
    key: "getUserConfig",
    value: function getUserConfig(opts) {
      var files = [];
      var config = {
        presets: [],
        plugins: []
      };
      var _iterator2 = _createForOfIteratorHelper(opts.configFiles),
        _step2;
      try {
        for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
          var configFile = _step2.value;
          if (isPathExistsSync(configFile)) {
            register.register({
              implementor: esbuild
            });
            register.clearFiles();
            try {
              // eslint-disable-next-line @typescript-eslint/no-var-requires
              config = deepMerge(config, require(configFile).default);
            } catch (e) {
              throw new Error("Parse config file failed: [".concat(configFile, "]"), {
                cause: e
              });
            }
            var _iterator3 = _createForOfIteratorHelper(register.getFiles()),
              _step3;
            try {
              for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
                var file = _step3.value;
                delete require.cache[file];
              }

              // includes the config File
            } catch (err) {
              _iterator3.e(err);
            } finally {
              _iterator3.f();
            }
            files.push.apply(files, _toConsumableArray(register.getFiles()));
            register.restore();
          } else {
            files.push(configFile);
          }
        }
      } catch (err) {
        _iterator2.e(err);
      } finally {
        _iterator2.f();
      }
      return {
        config: config,
        files: files
      };
    }
  }, {
    key: "validateConfig",
    value: function validateConfig(opts) {
      var errors = new Map();
      var configKeys = new Set(Object.keys(opts.config));
      for (var _i = 0, _Object$keys = Object.keys(opts.schemas); _i < _Object$keys.length; _i++) {
        var key = _Object$keys[_i];
        configKeys.delete(key);
        if (!opts.config[key]) {
          continue;
        }
        var schema = opts.schemas[key](joi);
        // invalid schema
        assert(joi.isSchema(schema), "schema for config ".concat(key, " is not valid."));
        var _schema$validate = schema.validate(opts.config[key]),
          error = _schema$validate.error;
        if (error) {
          errors.set(key, error);
        }
      }

      // invalid config values
      assert(errors.size === 0, "Invalid config values: ".concat(Array.from(errors.keys()).join(', '), "\n").concat(Array.from(errors.keys()).map(function (key) {
        return "Invalid value for ".concat(key, ":\n").concat(errors.get(key).message);
      })));
      // invalid config keys
      assert(configKeys.size === 0, "Invalid config keys: ".concat(Array.from(configKeys).join(', ')));
    }
  }]);
  return ConfigManager;
}();