function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }
function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }
function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : String(i); }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
import { camelCase, isPathExistsSync, register, resolve, winPath } from '@eljs/utils';
import assert from 'assert';
import esbuild from 'esbuild';
import sum from 'hash-sum';
import { basename, dirname, extname, join, relative } from 'path';
import pkgUp from 'pkg-up';
import { EnableBy } from "../enum";
export var Plugin = /*#__PURE__*/function () {
  function Plugin(opts) {
    var _this = this;
    _classCallCheck(this, Plugin);
    /**
     * 插件类型
     */
    _defineProperty(this, "type", void 0);
    /**
     * 预设/插件入口
     */
    _defineProperty(this, "path", void 0);
    /**
     * 插件 ID
     */
    _defineProperty(this, "id", void 0);
    /**
     * 插件 key
     */
    _defineProperty(this, "key", void 0);
    /**
     * 插件配置项
     */
    _defineProperty(this, "config", Object.create(null));
    /**
     * 插件执行时间
     */
    _defineProperty(this, "time", {
      hooks: {}
    });
    /**
     * 插件执行函数
     */
    _defineProperty(this, "apply", void 0);
    /**
     * 插件是否可以执行
     */
    _defineProperty(this, "enableBy", EnableBy.Register);
    /**
     * 当前路径
     */
    _defineProperty(this, "_cwd", void 0);
    /**
     * 当前路径
     */
    _defineProperty(this, "_prefix", void 0);
    /**
     * 插件唯一 key 正则映射表
     */
    _defineProperty(this, "_key2RegexMap", void 0);
    this.type = opts.type;
    this.path = winPath(opts.path);
    this._cwd = opts.cwd;
    this._prefix = opts.prefix || '@eljs/service-';
    assert(isPathExistsSync(this.path), "Invalid ".concat(this.type, " ").concat(this.path, ", it's not exists."));
    var pkgJSON = null;
    var isPkgEntry = false;
    var pkgJSONPath = pkgUp.sync({
      cwd: this.path
    });
    if (pkgJSONPath) {
      pkgJSON = require(pkgJSONPath);
      isPkgEntry = winPath(join(dirname(pkgJSONPath), pkgJSON.main || 'index.js')) === winPath(this.path);
    }
    this.id = this.getId({
      pkgJSON: pkgJSON,
      isPkgEntry: isPkgEntry,
      pkgJSONPath: pkgJSONPath
    });
    this.key = this.getKey({
      pkgJSON: pkgJSON,
      isPkgEntry: isPkgEntry
    });
    this.apply = function () {
      var _ret$config;
      register.register({
        implementor: esbuild,
        ignoreNodeModules: false,
        exts: ['.ts']
      });
      register.clearFiles();
      var ret;
      try {
        ret = require(_this.path);
      } catch (err) {
        throw new Error("Register ".concat(_this.type, " ").concat(_this.path, " failed, since ").concat(err.message));
      } finally {
        register.restore();
      }
      _this.config = (_ret$config = ret.config) !== null && _ret$config !== void 0 ? _ret$config : Object.create(null);

      // use the default member for es modules
      return ret.__esModule ? ret.default : ret;
    };
  }
  _createClass(Plugin, [{
    key: "key2RegexMap",
    get: function get() {
      if (!this._key2RegexMap) {
        this._key2RegexMap = {
          preset: new RegExp("^".concat(this._prefix, "preset-")),
          plugin: new RegExp("^".concat(this._prefix, "plugin-"))
        };
      }
      return this._key2RegexMap;
    }
  }, {
    key: "merge",
    value: function merge(opts) {
      if (opts.key) {
        this.key = opts.key;
      }
      if (opts.enableBy) {
        this.enableBy = opts.enableBy;
      }
    }
  }, {
    key: "getId",
    value: function getId(opts) {
      var pkgJSON = opts.pkgJSON,
        isPkgEntry = opts.isPkgEntry,
        pkgJSONPath = opts.pkgJSONPath;
      var id = '';
      if (isPkgEntry) {
        id = pkgJSON.name;
      } else if (winPath(this.path).startsWith(winPath(this._cwd))) {
        id = "./".concat(winPath(relative(this._cwd, this.path)));
      } else if (pkgJSONPath) {
        id = winPath(join(pkgJSON.name, relative(dirname(pkgJSONPath), this.path)));
      } else {
        id = winPath(this.path);
      }
      id = id.replace('@eljs/lib/core', '@@');
      id = id.replace(/\.js$/, '');
      return id;
    }
  }, {
    key: "getKey",
    value: function getKey(opts) {
      var pkgJSON = opts.pkgJSON,
        isPkgEntry = opts.isPkgEntry;
      // e.g.
      // initial-state -> initialState
      // webpack.css-loader -> webpack.cssLoader
      function nameToKey(name) {
        return name.split('.').map(function (part) {
          return camelCase(part);
        }).join('.');
      }
      if (isPkgEntry) {
        return nameToKey(Plugin.stripNoneScope(pkgJSON.name).replace(this.key2RegexMap[this.type], ''));
      }
      var key = basename(this.path, extname(this.path));
      if (key === 'index') {
        return "".concat(sum(this.path), "_").concat(key);
      }
      return nameToKey(key);
    }
  }], [{
    key: "stripNoneScope",
    value: function stripNoneScope(name) {
      if (name.charAt(0) === '@' && !name.startsWith('@eljs/')) {
        name = name.split('/')[1];
      }
      return name;
    }
  }, {
    key: "getPresetsAndPlugins",
    value: function getPresetsAndPlugins(opts) {
      function get(type) {
        var types = "".concat(type, "s");
        var presetsOrPlugins = opts[types] || [];
        var extractor = type === 'preset' ? opts.presetsExtractor : opts.pluginsExtractor;
        return [].concat(_toConsumableArray(presetsOrPlugins), _toConsumableArray(opts.userConfig[types] || []), _toConsumableArray((extractor === null || extractor === void 0 ? void 0 : extractor(presetsOrPlugins, opts.cwd, opts)) || [])).map(function (path) {
          assert(typeof path === 'string', "Invalid plugin ".concat(path, ", it must be string."));
          var resolved;
          try {
            resolved = resolve.sync(path, {
              basedir: opts.cwd,
              extensions: ['.tsx', '.ts', '.mjs', '.jsx', '.js']
            });
          } catch (_) {
            throw new Error("Invalid plugin ".concat(path, ", can not be resolved."));
          }
          return new Plugin({
            path: resolved,
            type: type,
            cwd: opts.cwd
          });
        });
      }
      return {
        presets: get('preset'),
        plugins: get('plugin')
      };
    }
  }]);
  return Plugin;
}();