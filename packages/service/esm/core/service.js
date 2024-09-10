function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _createForOfIteratorHelper(o, allowArrayLike) { var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"]; if (!it) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = it.call(o); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }
function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }
function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
function _regeneratorRuntime() { "use strict"; /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/facebook/regenerator/blob/main/LICENSE */ _regeneratorRuntime = function _regeneratorRuntime() { return e; }; var t, e = {}, r = Object.prototype, n = r.hasOwnProperty, o = Object.defineProperty || function (t, e, r) { t[e] = r.value; }, i = "function" == typeof Symbol ? Symbol : {}, a = i.iterator || "@@iterator", c = i.asyncIterator || "@@asyncIterator", u = i.toStringTag || "@@toStringTag"; function define(t, e, r) { return Object.defineProperty(t, e, { value: r, enumerable: !0, configurable: !0, writable: !0 }), t[e]; } try { define({}, ""); } catch (t) { define = function define(t, e, r) { return t[e] = r; }; } function wrap(t, e, r, n) { var i = e && e.prototype instanceof Generator ? e : Generator, a = Object.create(i.prototype), c = new Context(n || []); return o(a, "_invoke", { value: makeInvokeMethod(t, r, c) }), a; } function tryCatch(t, e, r) { try { return { type: "normal", arg: t.call(e, r) }; } catch (t) { return { type: "throw", arg: t }; } } e.wrap = wrap; var h = "suspendedStart", l = "suspendedYield", f = "executing", s = "completed", y = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} var p = {}; define(p, a, function () { return this; }); var d = Object.getPrototypeOf, v = d && d(d(values([]))); v && v !== r && n.call(v, a) && (p = v); var g = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(p); function defineIteratorMethods(t) { ["next", "throw", "return"].forEach(function (e) { define(t, e, function (t) { return this._invoke(e, t); }); }); } function AsyncIterator(t, e) { function invoke(r, o, i, a) { var c = tryCatch(t[r], t, o); if ("throw" !== c.type) { var u = c.arg, h = u.value; return h && "object" == _typeof(h) && n.call(h, "__await") ? e.resolve(h.__await).then(function (t) { invoke("next", t, i, a); }, function (t) { invoke("throw", t, i, a); }) : e.resolve(h).then(function (t) { u.value = t, i(u); }, function (t) { return invoke("throw", t, i, a); }); } a(c.arg); } var r; o(this, "_invoke", { value: function value(t, n) { function callInvokeWithMethodAndArg() { return new e(function (e, r) { invoke(t, n, e, r); }); } return r = r ? r.then(callInvokeWithMethodAndArg, callInvokeWithMethodAndArg) : callInvokeWithMethodAndArg(); } }); } function makeInvokeMethod(e, r, n) { var o = h; return function (i, a) { if (o === f) throw new Error("Generator is already running"); if (o === s) { if ("throw" === i) throw a; return { value: t, done: !0 }; } for (n.method = i, n.arg = a;;) { var c = n.delegate; if (c) { var u = maybeInvokeDelegate(c, n); if (u) { if (u === y) continue; return u; } } if ("next" === n.method) n.sent = n._sent = n.arg;else if ("throw" === n.method) { if (o === h) throw o = s, n.arg; n.dispatchException(n.arg); } else "return" === n.method && n.abrupt("return", n.arg); o = f; var p = tryCatch(e, r, n); if ("normal" === p.type) { if (o = n.done ? s : l, p.arg === y) continue; return { value: p.arg, done: n.done }; } "throw" === p.type && (o = s, n.method = "throw", n.arg = p.arg); } }; } function maybeInvokeDelegate(e, r) { var n = r.method, o = e.iterator[n]; if (o === t) return r.delegate = null, "throw" === n && e.iterator.return && (r.method = "return", r.arg = t, maybeInvokeDelegate(e, r), "throw" === r.method) || "return" !== n && (r.method = "throw", r.arg = new TypeError("The iterator does not provide a '" + n + "' method")), y; var i = tryCatch(o, e.iterator, r.arg); if ("throw" === i.type) return r.method = "throw", r.arg = i.arg, r.delegate = null, y; var a = i.arg; return a ? a.done ? (r[e.resultName] = a.value, r.next = e.nextLoc, "return" !== r.method && (r.method = "next", r.arg = t), r.delegate = null, y) : a : (r.method = "throw", r.arg = new TypeError("iterator result is not an object"), r.delegate = null, y); } function pushTryEntry(t) { var e = { tryLoc: t[0] }; 1 in t && (e.catchLoc = t[1]), 2 in t && (e.finallyLoc = t[2], e.afterLoc = t[3]), this.tryEntries.push(e); } function resetTryEntry(t) { var e = t.completion || {}; e.type = "normal", delete e.arg, t.completion = e; } function Context(t) { this.tryEntries = [{ tryLoc: "root" }], t.forEach(pushTryEntry, this), this.reset(!0); } function values(e) { if (e || "" === e) { var r = e[a]; if (r) return r.call(e); if ("function" == typeof e.next) return e; if (!isNaN(e.length)) { var o = -1, i = function next() { for (; ++o < e.length;) if (n.call(e, o)) return next.value = e[o], next.done = !1, next; return next.value = t, next.done = !0, next; }; return i.next = i; } } throw new TypeError(_typeof(e) + " is not iterable"); } return GeneratorFunction.prototype = GeneratorFunctionPrototype, o(g, "constructor", { value: GeneratorFunctionPrototype, configurable: !0 }), o(GeneratorFunctionPrototype, "constructor", { value: GeneratorFunction, configurable: !0 }), GeneratorFunction.displayName = define(GeneratorFunctionPrototype, u, "GeneratorFunction"), e.isGeneratorFunction = function (t) { var e = "function" == typeof t && t.constructor; return !!e && (e === GeneratorFunction || "GeneratorFunction" === (e.displayName || e.name)); }, e.mark = function (t) { return Object.setPrototypeOf ? Object.setPrototypeOf(t, GeneratorFunctionPrototype) : (t.__proto__ = GeneratorFunctionPrototype, define(t, u, "GeneratorFunction")), t.prototype = Object.create(g), t; }, e.awrap = function (t) { return { __await: t }; }, defineIteratorMethods(AsyncIterator.prototype), define(AsyncIterator.prototype, c, function () { return this; }), e.AsyncIterator = AsyncIterator, e.async = function (t, r, n, o, i) { void 0 === i && (i = Promise); var a = new AsyncIterator(wrap(t, r, n, o), i); return e.isGeneratorFunction(r) ? a : a.next().then(function (t) { return t.done ? t.value : a.next(); }); }, defineIteratorMethods(g), define(g, u, "Generator"), define(g, a, function () { return this; }), define(g, "toString", function () { return "[object Generator]"; }), e.keys = function (t) { var e = Object(t), r = []; for (var n in e) r.push(n); return r.reverse(), function next() { for (; r.length;) { var t = r.pop(); if (t in e) return next.value = t, next.done = !1, next; } return next.done = !0, next; }; }, e.values = values, Context.prototype = { constructor: Context, reset: function reset(e) { if (this.prev = 0, this.next = 0, this.sent = this._sent = t, this.done = !1, this.delegate = null, this.method = "next", this.arg = t, this.tryEntries.forEach(resetTryEntry), !e) for (var r in this) "t" === r.charAt(0) && n.call(this, r) && !isNaN(+r.slice(1)) && (this[r] = t); }, stop: function stop() { this.done = !0; var t = this.tryEntries[0].completion; if ("throw" === t.type) throw t.arg; return this.rval; }, dispatchException: function dispatchException(e) { if (this.done) throw e; var r = this; function handle(n, o) { return a.type = "throw", a.arg = e, r.next = n, o && (r.method = "next", r.arg = t), !!o; } for (var o = this.tryEntries.length - 1; o >= 0; --o) { var i = this.tryEntries[o], a = i.completion; if ("root" === i.tryLoc) return handle("end"); if (i.tryLoc <= this.prev) { var c = n.call(i, "catchLoc"), u = n.call(i, "finallyLoc"); if (c && u) { if (this.prev < i.catchLoc) return handle(i.catchLoc, !0); if (this.prev < i.finallyLoc) return handle(i.finallyLoc); } else if (c) { if (this.prev < i.catchLoc) return handle(i.catchLoc, !0); } else { if (!u) throw new Error("try statement without catch or finally"); if (this.prev < i.finallyLoc) return handle(i.finallyLoc); } } } }, abrupt: function abrupt(t, e) { for (var r = this.tryEntries.length - 1; r >= 0; --r) { var o = this.tryEntries[r]; if (o.tryLoc <= this.prev && n.call(o, "finallyLoc") && this.prev < o.finallyLoc) { var i = o; break; } } i && ("break" === t || "continue" === t) && i.tryLoc <= e && e <= i.finallyLoc && (i = null); var a = i ? i.completion : {}; return a.type = t, a.arg = e, i ? (this.method = "next", this.next = i.finallyLoc, y) : this.complete(a); }, complete: function complete(t, e) { if ("throw" === t.type) throw t.arg; return "break" === t.type || "continue" === t.type ? this.next = t.arg : "return" === t.type ? (this.rval = this.arg = t.arg, this.method = "return", this.next = "end") : "normal" === t.type && e && (this.next = e), y; }, finish: function finish(t) { for (var e = this.tryEntries.length - 1; e >= 0; --e) { var r = this.tryEntries[e]; if (r.finallyLoc === t) return this.complete(r.completion, r.afterLoc), resetTryEntry(r), y; } }, catch: function _catch(t) { for (var e = this.tryEntries.length - 1; e >= 0; --e) { var r = this.tryEntries[e]; if (r.tryLoc === t) { var n = r.completion; if ("throw" === n.type) { var o = n.arg; resetTryEntry(r); } return o; } } throw new Error("illegal catch attempt"); }, delegateYield: function delegateYield(e, r, n) { return this.delegate = { iterator: values(e), resultName: r, nextLoc: n }, "next" === this.method && (this.arg = t), y; } }, e; }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }
function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }
function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : String(i); }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
import { ApplyPluginsType, PluginType, ServiceStage } from "../types";
import * as utils from '@eljs/utils';
import assert from 'assert';
import fastestLevenshtein from 'fastest-levenshtein';
import _ from 'lodash';
import { AsyncSeriesWaterfallHook } from 'tapable';
import { ConfigManager } from "../config/manager";
import { EnableBy } from "../enum";
import { Plugin } from "./plugin";
import { PluginAPI } from "./plugin-api";
export var Service = /*#__PURE__*/function () {
  function Service(opts) {
    _classCallCheck(this, Service);
    /**
     * 构造函数配置项
     */
    _defineProperty(this, "opts", void 0);
    /**
     * 当前执行路径
     */
    _defineProperty(this, "cwd", void 0);
    /**
     * 目标执行路径
     */
    _defineProperty(this, "target", '');
    /**
     * 当前环境
     */
    _defineProperty(this, "env", void 0);
    /**
     * 执行 `run` 函数时传入的名字（具体的命令）
     */
    _defineProperty(this, "name", '');
    /**
     * bin 名称
     */
    _defineProperty(this, "binName", '');
    /**
     * 其它执行参数
     */
    _defineProperty(this, "args", {
      _: []
    });
    /**
     * 用户项目配置
     */
    _defineProperty(this, "userConfig", {
      presets: [],
      plugins: []
    });
    /**
     * 配置管理器
     */
    _defineProperty(this, "configManager", void 0);
    /**
     * 执行阶段
     */
    _defineProperty(this, "stage", ServiceStage.Uninitialized);
    /**
     * 插件配置项，是否启用可通过 `modifyConfig` 方法修改
     */
    _defineProperty(this, "pluginConfig", Object.create(null));
    /**
     * 存储全局数据
     */
    _defineProperty(this, "appData", Object.create(null));
    /**
     * 存储项目路径
     */
    _defineProperty(this, "paths", {
      cwd: '',
      target: ''
    });
    /**
     * 钩子映射表
     */
    _defineProperty(this, "hooks", Object.create(null));
    /**
     * 命令集合
     */
    _defineProperty(this, "commands", Object.create(null));
    /**
     * 微生成器集合
     */
    _defineProperty(this, "generators", Object.create(null));
    /**
     * 插件集合
     */
    _defineProperty(this, "plugins", Object.create(null));
    /**
     * 插件映射表
     */
    _defineProperty(this, "keyToPluginMap", Object.create(null));
    /**
     * 插件方法集合
     */
    _defineProperty(this, "pluginMethods", {});
    /**
     * 跳过插件的 ID 集合
     */
    _defineProperty(this, "skipPluginIds", new Set());
    /**
     * Npm 包前缀
     */
    _defineProperty(this, "_prefix", void 0);
    assert(utils.isPathExistsSync(opts.cwd), "Invalid cwd ".concat(opts.cwd, ", it's not found."));
    this.opts = opts;
    this.cwd = opts.cwd;
    this.env = opts.env;
    this.binName = opts.binName || 'eljs';
    this._prefix = opts.frameworkName ? opts.frameworkName.endsWith('-') ? opts.frameworkName : "".concat(opts.frameworkName, "-") : '@eljs/service-';
    this.configManager = new ConfigManager({
      cwd: this.cwd,
      env: this.env,
      defaultConfigFiles: this.opts.defaultConfigFiles
    });
    this.userConfig = this.configManager.getUserConfig().config;
  }
  _createClass(Service, [{
    key: "initPlugin",
    value: function () {
      var _initPlugin = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee(opts) {
        var _this$plugins$opts$pl,
          _this$keyToPluginMap$,
          _this = this;
        var pluginAPI, _this$proxyPluginAPIP, serviceProps, staticProps, proxyPluginAPI, ret, dateStart, pluginRet;
        return _regeneratorRuntime().wrap(function _callee$(_context) {
          while (1) switch (_context.prev = _context.next) {
            case 0:
              // register to this.plugins
              assert(!this.plugins[opts.plugin.id], "".concat(opts.plugin.type, " ").concat(opts.plugin.id, " is already registered by ").concat((_this$plugins$opts$pl = this.plugins[opts.plugin.id]) === null || _this$plugins$opts$pl === void 0 ? void 0 : _this$plugins$opts$pl.path, ", ").concat(opts.plugin.type, " from ").concat(opts.plugin.path, " register failed."));
              this.plugins[opts.plugin.id] = opts.plugin;

              // apply with PluginAPI
              pluginAPI = new PluginAPI({
                plugin: opts.plugin,
                service: this
              });
              pluginAPI.registerPresets = pluginAPI.registerPresets.bind(pluginAPI, opts.presets || [], this._prefix);
              pluginAPI.registerPlugins = pluginAPI.registerPlugins.bind(pluginAPI, opts.plugins, this._prefix);
              _this$proxyPluginAPIP = this.proxyPluginAPIPropsExtractor(), serviceProps = _this$proxyPluginAPIP.serviceProps, staticProps = _this$proxyPluginAPIP.staticProps;
              proxyPluginAPI = PluginAPI.proxyPluginAPI({
                service: this,
                pluginAPI: pluginAPI,
                serviceProps: _.union(['cwd', 'name', 'binName', 'args', 'userConfig', 'appData', 'paths', 'commands', 'generators', 'pluginConfig', 'applyPlugins', 'isPluginEnable'], serviceProps),
                staticProps: _.merge({
                  ApplyPluginsType: ApplyPluginsType,
                  EnableBy: EnableBy,
                  PluginType: PluginType,
                  service: this,
                  utils: utils,
                  lodash: _
                }, staticProps)
              });
              ret = Object.create(null);
              dateStart = new Date();
              _context.next = 11;
              return opts.plugin.apply()(proxyPluginAPI);
            case 11:
              pluginRet = _context.sent;
              opts.plugin.time.register = new Date().getTime() - dateStart.getTime();
              if (opts.plugin.type === 'plugin') {
                assert(!pluginRet, "plugin should return nothing.");
              }

              // key should be unique
              assert(!this.keyToPluginMap[opts.plugin.key], "key ".concat(opts.plugin.key, " is already registered by ").concat((_this$keyToPluginMap$ = this.keyToPluginMap[opts.plugin.key]) === null || _this$keyToPluginMap$ === void 0 ? void 0 : _this$keyToPluginMap$.path, ", ").concat(opts.plugin.type, " from ").concat(opts.plugin.path, " register failed."));
              this.keyToPluginMap[opts.plugin.key] = opts.plugin;
              if (pluginRet !== null && pluginRet !== void 0 && pluginRet.presets) {
                ret.presets = pluginRet.presets.map(function (preset) {
                  return new Plugin({
                    path: preset,
                    type: PluginType.Preset,
                    cwd: _this.cwd,
                    prefix: _this._prefix
                  });
                });
              }
              if (pluginRet !== null && pluginRet !== void 0 && pluginRet.plugins) {
                ret.plugins = pluginRet.plugins.map(function (plugin) {
                  return new Plugin({
                    path: plugin,
                    type: PluginType.Plugin,
                    cwd: _this.cwd,
                    prefix: _this._prefix
                  });
                });
              }

              // merge plugin config
              this.pluginConfig = _objectSpread(_objectSpread({}, this.pluginConfig), opts.plugin.config);
              return _context.abrupt("return", ret);
            case 20:
            case "end":
              return _context.stop();
          }
        }, _callee, this);
      }));
      function initPlugin(_x) {
        return _initPlugin.apply(this, arguments);
      }
      return initPlugin;
    }()
  }, {
    key: "initPreset",
    value: function () {
      var _initPreset = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee2(opts) {
        var _opts$presets, _opts$plugins;
        var _yield$this$initPlugi, presets, plugins;
        return _regeneratorRuntime().wrap(function _callee2$(_context2) {
          while (1) switch (_context2.prev = _context2.next) {
            case 0:
              _context2.next = 2;
              return this.initPlugin({
                plugin: opts.preset,
                presets: opts.presets,
                plugins: opts.plugins
              });
            case 2:
              _yield$this$initPlugi = _context2.sent;
              presets = _yield$this$initPlugi.presets;
              plugins = _yield$this$initPlugi.plugins;
              (_opts$presets = opts.presets).unshift.apply(_opts$presets, _toConsumableArray(presets || []));
              (_opts$plugins = opts.plugins).push.apply(_opts$plugins, _toConsumableArray(plugins || []));
            case 7:
            case "end":
              return _context2.stop();
          }
        }, _callee2, this);
      }));
      function initPreset(_x2) {
        return _initPreset.apply(this, arguments);
      }
      return initPreset;
    }()
  }, {
    key: "applyPlugins",
    value: function () {
      var _applyPlugins = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee6(opts) {
        var _this2 = this;
        var type, hooks, tAdd, _iterator, _step, _loop, tModify, _iterator2, _step2, _loop2, tEvent, _iterator3, _step3, _loop3;
        return _regeneratorRuntime().wrap(function _callee6$(_context9) {
          while (1) switch (_context9.prev = _context9.next) {
            case 0:
              type = opts.type; // guess type from key
              if (type) {
                _context9.next = 15;
                break;
              }
              if (!opts.key.startsWith('on')) {
                _context9.next = 6;
                break;
              }
              type = ApplyPluginsType.Event;
              _context9.next = 15;
              break;
            case 6:
              if (!opts.key.startsWith('modify')) {
                _context9.next = 10;
                break;
              }
              type = ApplyPluginsType.Modify;
              _context9.next = 15;
              break;
            case 10:
              if (!opts.key.startsWith('add')) {
                _context9.next = 14;
                break;
              }
              type = ApplyPluginsType.Add;
              _context9.next = 15;
              break;
            case 14:
              throw new Error("Invalid applyPlugins arguments, type must be supplied for key ".concat(opts.key, "."));
            case 15:
              hooks = this.hooks[opts.key] || [];
              _context9.t0 = type;
              _context9.next = _context9.t0 === ApplyPluginsType.Add ? 19 : _context9.t0 === ApplyPluginsType.Modify ? 40 : _context9.t0 === ApplyPluginsType.Event ? 60 : 80;
              break;
            case 19:
              assert(!('initialValue' in opts) || Array.isArray(opts.initialValue), "applyPlugins failed, opts.initialValue must be Array if opts.type is add.");

              // eslint-disable-next-line no-case-declarations
              tAdd = new AsyncSeriesWaterfallHook(['memo']);
              _iterator = _createForOfIteratorHelper(hooks);
              _context9.prev = 22;
              _loop = /*#__PURE__*/_regeneratorRuntime().mark(function _loop() {
                var hook;
                return _regeneratorRuntime().wrap(function _loop$(_context4) {
                  while (1) switch (_context4.prev = _context4.next) {
                    case 0:
                      hook = _step.value;
                      if (_this2.isPluginEnable(hook)) {
                        _context4.next = 3;
                        break;
                      }
                      return _context4.abrupt("return", 1);
                    case 3:
                      tAdd.tapPromise({
                        name: hook.plugin.key,
                        stage: hook.stage,
                        before: hook.before
                      }, /*#__PURE__*/function () {
                        var _ref = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee3(memo) {
                          var _hook$plugin$time$hoo, _opts$key;
                          var dateStart, items;
                          return _regeneratorRuntime().wrap(function _callee3$(_context3) {
                            while (1) switch (_context3.prev = _context3.next) {
                              case 0:
                                dateStart = new Date();
                                _context3.next = 3;
                                return hook.fn(opts.args);
                              case 3:
                                items = _context3.sent;
                                (_hook$plugin$time$hoo = hook.plugin.time.hooks)[_opts$key = opts.key] || (_hook$plugin$time$hoo[_opts$key] = []);
                                hook.plugin.time.hooks[opts.key].push(new Date().getTime() - dateStart.getTime());
                                return _context3.abrupt("return", memo.concat(items));
                              case 7:
                              case "end":
                                return _context3.stop();
                            }
                          }, _callee3);
                        }));
                        return function (_x4) {
                          return _ref.apply(this, arguments);
                        };
                      }());
                    case 4:
                    case "end":
                      return _context4.stop();
                  }
                }, _loop);
              });
              _iterator.s();
            case 25:
              if ((_step = _iterator.n()).done) {
                _context9.next = 31;
                break;
              }
              return _context9.delegateYield(_loop(), "t1", 27);
            case 27:
              if (!_context9.t1) {
                _context9.next = 29;
                break;
              }
              return _context9.abrupt("continue", 29);
            case 29:
              _context9.next = 25;
              break;
            case 31:
              _context9.next = 36;
              break;
            case 33:
              _context9.prev = 33;
              _context9.t2 = _context9["catch"](22);
              _iterator.e(_context9.t2);
            case 36:
              _context9.prev = 36;
              _iterator.f();
              return _context9.finish(36);
            case 39:
              return _context9.abrupt("return", tAdd.promise(opts.initialValue || []));
            case 40:
              // eslint-disable-next-line no-case-declarations
              tModify = new AsyncSeriesWaterfallHook(['memo']);
              _iterator2 = _createForOfIteratorHelper(hooks);
              _context9.prev = 42;
              _loop2 = /*#__PURE__*/_regeneratorRuntime().mark(function _loop2() {
                var hook;
                return _regeneratorRuntime().wrap(function _loop2$(_context6) {
                  while (1) switch (_context6.prev = _context6.next) {
                    case 0:
                      hook = _step2.value;
                      if (_this2.isPluginEnable(hook)) {
                        _context6.next = 3;
                        break;
                      }
                      return _context6.abrupt("return", 1);
                    case 3:
                      tModify.tapPromise({
                        name: hook.plugin.key,
                        stage: hook.stage,
                        before: hook.before
                      }, /*#__PURE__*/function () {
                        var _ref2 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee4(memo) {
                          var _hook$plugin$time$hoo2, _opts$key2;
                          var dateStart, ret;
                          return _regeneratorRuntime().wrap(function _callee4$(_context5) {
                            while (1) switch (_context5.prev = _context5.next) {
                              case 0:
                                dateStart = new Date();
                                _context5.next = 3;
                                return hook.fn(memo, opts.args);
                              case 3:
                                ret = _context5.sent;
                                (_hook$plugin$time$hoo2 = hook.plugin.time.hooks)[_opts$key2 = opts.key] || (_hook$plugin$time$hoo2[_opts$key2] = []);
                                hook.plugin.time.hooks[opts.key].push(new Date().getTime() - dateStart.getTime());
                                return _context5.abrupt("return", ret);
                              case 7:
                              case "end":
                                return _context5.stop();
                            }
                          }, _callee4);
                        }));
                        return function (_x5) {
                          return _ref2.apply(this, arguments);
                        };
                      }());
                    case 4:
                    case "end":
                      return _context6.stop();
                  }
                }, _loop2);
              });
              _iterator2.s();
            case 45:
              if ((_step2 = _iterator2.n()).done) {
                _context9.next = 51;
                break;
              }
              return _context9.delegateYield(_loop2(), "t3", 47);
            case 47:
              if (!_context9.t3) {
                _context9.next = 49;
                break;
              }
              return _context9.abrupt("continue", 49);
            case 49:
              _context9.next = 45;
              break;
            case 51:
              _context9.next = 56;
              break;
            case 53:
              _context9.prev = 53;
              _context9.t4 = _context9["catch"](42);
              _iterator2.e(_context9.t4);
            case 56:
              _context9.prev = 56;
              _iterator2.f();
              return _context9.finish(56);
            case 59:
              return _context9.abrupt("return", tModify.promise(opts.initialValue));
            case 60:
              // eslint-disable-next-line no-case-declarations
              tEvent = new AsyncSeriesWaterfallHook(['_']);
              _iterator3 = _createForOfIteratorHelper(hooks);
              _context9.prev = 62;
              _loop3 = /*#__PURE__*/_regeneratorRuntime().mark(function _loop3() {
                var hook;
                return _regeneratorRuntime().wrap(function _loop3$(_context8) {
                  while (1) switch (_context8.prev = _context8.next) {
                    case 0:
                      hook = _step3.value;
                      if (_this2.isPluginEnable(hook)) {
                        _context8.next = 3;
                        break;
                      }
                      return _context8.abrupt("return", 1);
                    case 3:
                      tEvent.tapPromise({
                        name: hook.plugin.key,
                        stage: hook.stage || 0,
                        before: hook.before
                      }, /*#__PURE__*/_asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee5() {
                        var _hook$plugin$time$hoo3, _opts$key3;
                        var dateStart;
                        return _regeneratorRuntime().wrap(function _callee5$(_context7) {
                          while (1) switch (_context7.prev = _context7.next) {
                            case 0:
                              dateStart = new Date();
                              _context7.next = 3;
                              return hook.fn(opts.args);
                            case 3:
                              (_hook$plugin$time$hoo3 = hook.plugin.time.hooks)[_opts$key3 = opts.key] || (_hook$plugin$time$hoo3[_opts$key3] = []);
                              hook.plugin.time.hooks[opts.key].push(new Date().getTime() - dateStart.getTime());
                            case 5:
                            case "end":
                              return _context7.stop();
                          }
                        }, _callee5);
                      })));
                    case 4:
                    case "end":
                      return _context8.stop();
                  }
                }, _loop3);
              });
              _iterator3.s();
            case 65:
              if ((_step3 = _iterator3.n()).done) {
                _context9.next = 71;
                break;
              }
              return _context9.delegateYield(_loop3(), "t5", 67);
            case 67:
              if (!_context9.t5) {
                _context9.next = 69;
                break;
              }
              return _context9.abrupt("continue", 69);
            case 69:
              _context9.next = 65;
              break;
            case 71:
              _context9.next = 76;
              break;
            case 73:
              _context9.prev = 73;
              _context9.t6 = _context9["catch"](62);
              _iterator3.e(_context9.t6);
            case 76:
              _context9.prev = 76;
              _iterator3.f();
              return _context9.finish(76);
            case 79:
              return _context9.abrupt("return", tEvent.promise(1));
            case 80:
              throw new Error("applyPlugins failed, type is not defined or is not matched, got ".concat(opts.type, "."));
            case 81:
            case "end":
              return _context9.stop();
          }
        }, _callee6, this, [[22, 33, 36, 39], [42, 53, 56, 59], [62, 73, 76, 79]]);
      }));
      function applyPlugins(_x3) {
        return _applyPlugins.apply(this, arguments);
      }
      return applyPlugins;
    }()
  }, {
    key: "run",
    value: function () {
      var _run = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee7(opts) {
        var _opts$name, name, _opts$target, target, _opts$args, args, _Plugin$getPresetsAnd, plugins, presets, presetPlugins, pluginConfigInitialValue, defaultPaths, pathsInitialValue, defaultAppData, appDataInitialValue;
        return _regeneratorRuntime().wrap(function _callee7$(_context10) {
          while (1) switch (_context10.prev = _context10.next) {
            case 0:
              _opts$name = opts.name, name = _opts$name === void 0 ? '' : _opts$name, _opts$target = opts.target, target = _opts$target === void 0 ? this.cwd : _opts$target, _opts$args = opts.args, args = _opts$args === void 0 ? {} : _opts$args;
              args._ = args._ || [];
              // shift the command itself
              if (args._[0] === name) {
                args._.shift();
              }
              this.name = name;
              this.target = target;
              this.args = args;
              _context10.next = 8;
              return this.beforeRun(opts, this);
            case 8:
              this.stage = ServiceStage.Init;
              _Plugin$getPresetsAnd = Plugin.getPresetsAndPlugins({
                cwd: this.cwd,
                userConfig: this.userConfig,
                presets: [require.resolve("./service-plugin")].concat(this.opts.presets || []),
                plugins: [require.resolve("./command-plugin")].concat(this.opts.plugins || []),
                presetsExtractor: this.presetsExtractor,
                pluginsExtractor: this.pluginsExtractor
              }), plugins = _Plugin$getPresetsAnd.plugins, presets = _Plugin$getPresetsAnd.presets; // register presets
              this.stage = ServiceStage.InitPresets;
              presetPlugins = [];
            case 12:
              if (!presets.length) {
                _context10.next = 17;
                break;
              }
              _context10.next = 15;
              return this.initPreset({
                preset: presets.shift(),
                presets: presets,
                plugins: presetPlugins
              });
            case 15:
              _context10.next = 12;
              break;
            case 17:
              plugins.unshift.apply(plugins, presetPlugins);

              // register plugins
              this.stage = ServiceStage.InitPlugins;
            case 19:
              if (!plugins.length) {
                _context10.next = 24;
                break;
              }
              _context10.next = 22;
              return this.initPlugin({
                plugin: plugins.shift(),
                plugins: plugins
              });
            case 22:
              _context10.next = 19;
              break;
            case 24:
              if (!(name && !this.commands[name])) {
                _context10.next = 27;
                break;
              }
              this.commandGuessHelper(Object.keys(this.commands), name);
              throw Error("Invalid command ".concat(utils.chalk.red(name), ", it's not registered."));
            case 27:
              _context10.next = 29;
              return this.beforeModifyPluginConfig(opts, this.pluginConfig, this);
            case 29:
              _context10.t0 = _context10.sent;
              if (_context10.t0) {
                _context10.next = 32;
                break;
              }
              _context10.t0 = this.pluginConfig;
            case 32:
              pluginConfigInitialValue = _context10.t0;
              _context10.next = 35;
              return this.applyPlugins({
                key: 'modifyPluginConfig',
                initialValue: pluginConfigInitialValue,
                args: {}
              });
            case 35:
              this.pluginConfig = _context10.sent;
              defaultPaths = {
                cwd: this.cwd,
                target: target
              };
              _context10.next = 39;
              return this.beforeModifyPaths(opts, defaultPaths, this);
            case 39:
              _context10.t1 = _context10.sent;
              if (_context10.t1) {
                _context10.next = 42;
                break;
              }
              _context10.t1 = defaultPaths;
            case 42:
              pathsInitialValue = _context10.t1;
              _context10.next = 45;
              return this.applyPlugins({
                key: 'modifyPaths',
                initialValue: pathsInitialValue,
                args: {
                  cwd: this.cwd
                }
              });
            case 45:
              this.paths = _context10.sent;
              defaultAppData = {
                cwd: this.cwd,
                target: target,
                name: name,
                args: args
              };
              _context10.next = 49;
              return this.beforeModifyAppData(opts, defaultAppData, this);
            case 49:
              _context10.t2 = _context10.sent;
              if (_context10.t2) {
                _context10.next = 52;
                break;
              }
              _context10.t2 = defaultAppData;
            case 52:
              appDataInitialValue = _context10.t2;
              // applyPlugin collect app data
              this.stage = ServiceStage.CollectAppData;
              _context10.next = 56;
              return this.applyPlugins({
                key: 'modifyAppData',
                initialValue: appDataInitialValue
              });
            case 56:
              this.appData = _context10.sent;
              _context10.next = 59;
              return this.beforeRunCommand(opts, this);
            case 59:
              // applyPlugin onCheck
              this.stage = ServiceStage.OnCheck;
              _context10.next = 62;
              return this.applyPlugins({
                key: 'onCheck'
              });
            case 62:
              // applyPlugin onStart
              this.stage = ServiceStage.OnStart;
              _context10.next = 65;
              return this.applyPlugins({
                key: 'onStart'
              });
            case 65:
              if (!this.commands[name]) {
                _context10.next = 69;
                break;
              }
              this.stage = ServiceStage.RunCommand;
              _context10.next = 69;
              return this.commands[name].fn({
                args: args
              });
            case 69:
              _context10.next = 71;
              return this.afterRun(opts, this);
            case 71:
              this._baconPlugins();
            case 72:
            case "end":
              return _context10.stop();
          }
        }, _callee7, this);
      }));
      function run(_x6) {
        return _run.apply(this, arguments);
      }
      return run;
    }()
  }, {
    key: "isPluginEnable",
    value: function isPluginEnable(hook) {
      var plugin;
      if (hook.plugin) {
        plugin = hook.plugin;
      } else {
        plugin = this.keyToPluginMap[hook];
      }
      var _plugin = plugin,
        id = _plugin.id,
        enableBy = _plugin.enableBy;
      if (this.skipPluginIds.has(id)) {
        return false;
      }
      if (typeof enableBy === 'function') {
        return enableBy();
      }
      return this.isPluginEnableBy(plugin);
    }
  }, {
    key: "commandGuessHelper",
    value: function commandGuessHelper(commands, currentCmd) {
      var altCommands = commands.filter(function (cmd) {
        return fastestLevenshtein.distance(currentCmd, cmd) < currentCmd.length * 0.6 && currentCmd !== cmd;
      });
      var printHelper = altCommands.slice(0, 3).map(function (cmd) {
        return " - ".concat(utils.chalk.green(cmd));
      }).join('\n');
      if (altCommands.length) {
        console.log();
        console.log([utils.chalk.cyan(altCommands.length === 1 ? 'Did you mean this command ?' : 'Did you mean one of these commands ?'), printHelper].join('\n'));
        console.log();
      }
    }

    /**
     * 执行 `run` 方法之前调用的钩子
     */
  }, {
    key: "beforeRun",
    value: (function () {
      var _beforeRun = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee8(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      opts,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      service
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      ) {
        return _regeneratorRuntime().wrap(function _callee8$(_context11) {
          while (1) switch (_context11.prev = _context11.next) {
            case 0:
            case "end":
              return _context11.stop();
          }
        }, _callee8);
      }));
      function beforeRun(_x7, _x8) {
        return _beforeRun.apply(this, arguments);
      }
      return beforeRun;
    }()
    /**
     * 执行 `applyPlugin('modifyConfig')` 之前调用的钩子
     */
    )
  }, {
    key: "beforeModifyPluginConfig",
    value: (function () {
      var _beforeModifyPluginConfig = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee9(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      opts,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      config,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      service
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      ) {
        return _regeneratorRuntime().wrap(function _callee9$(_context12) {
          while (1) switch (_context12.prev = _context12.next) {
            case 0:
            case "end":
              return _context12.stop();
          }
        }, _callee9);
      }));
      function beforeModifyPluginConfig(_x9, _x10, _x11) {
        return _beforeModifyPluginConfig.apply(this, arguments);
      }
      return beforeModifyPluginConfig;
    }()
    /**
     * 执行 `applyPlugin('modifyPaths')` 之前调用的钩子
     */
    // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
    )
  }, {
    key: "beforeModifyPaths",
    value: (function () {
      var _beforeModifyPaths = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee10(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      opts,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      paths,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      service
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      ) {
        return _regeneratorRuntime().wrap(function _callee10$(_context13) {
          while (1) switch (_context13.prev = _context13.next) {
            case 0:
            case "end":
              return _context13.stop();
          }
        }, _callee10);
      }));
      function beforeModifyPaths(_x12, _x13, _x14) {
        return _beforeModifyPaths.apply(this, arguments);
      }
      return beforeModifyPaths;
    }()
    /**
     * 执行 `applyPlugin('modifyAppData')' 之前调用的钩子
     */
    // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
    )
  }, {
    key: "beforeModifyAppData",
    value: (function () {
      var _beforeModifyAppData = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee11(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      opts,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      appData,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      service
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      ) {
        return _regeneratorRuntime().wrap(function _callee11$(_context14) {
          while (1) switch (_context14.prev = _context14.next) {
            case 0:
            case "end":
              return _context14.stop();
          }
        }, _callee11);
      }));
      function beforeModifyAppData(_x15, _x16, _x17) {
        return _beforeModifyAppData.apply(this, arguments);
      }
      return beforeModifyAppData;
    }()
    /**
     * 执行命令之前的钩子
     */
    // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
    )
  }, {
    key: "beforeRunCommand",
    value: (function () {
      var _beforeRunCommand = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee12(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      opts,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      service
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      ) {
        return _regeneratorRuntime().wrap(function _callee12$(_context15) {
          while (1) switch (_context15.prev = _context15.next) {
            case 0:
            case "end":
              return _context15.stop();
          }
        }, _callee12);
      }));
      function beforeRunCommand(_x18, _x19) {
        return _beforeRunCommand.apply(this, arguments);
      }
      return beforeRunCommand;
    }()
    /**
     * 执行 `run` 方法之后的钩子
     */
    )
  }, {
    key: "afterRun",
    value: (function () {
      var _afterRun = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee13(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      opts,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      service
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      ) {
        return _regeneratorRuntime().wrap(function _callee13$(_context16) {
          while (1) switch (_context16.prev = _context16.next) {
            case 0:
            case "end":
              return _context16.stop();
          }
        }, _callee13);
      }));
      function afterRun(_x20, _x21) {
        return _afterRun.apply(this, arguments);
      }
      return afterRun;
    }()
    /**
     * 自定义的预设提取器
     */
    )
  }, {
    key: "presetsExtractor",
    value: function presetsExtractor(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    presets,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    cwd,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    opts
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ) {
      return [];
    }

    /**
     * 自定义的插件提取器
     */
  }, {
    key: "pluginsExtractor",
    value: function pluginsExtractor(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    plugins,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    cwd,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    opts
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ) {
      return [];
    }

    /**
     * 自定义的代理插件API属性提取器
     */
  }, {
    key: "proxyPluginAPIPropsExtractor",
    value: function proxyPluginAPIPropsExtractor() {
      return Object.create(null);
    }

    /**
     * 插件是否可以启用，需要优先满足 `Service#isPluginEnable` 的逻辑
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  }, {
    key: "isPluginEnableBy",
    value: function isPluginEnableBy(plugin) {
      return true;
    }
  }, {
    key: "_baconPlugins",
    value: function _baconPlugins() {
      if (this.args.baconPlugins) {
        console.log();
        for (var _i = 0, _Object$keys = Object.keys(this.plugins); _i < _Object$keys.length; _i++) {
          var id = _Object$keys[_i];
          var plugin = this.plugins[id];
          console.log(utils.chalk.green('plugin'), plugin.id, plugin.time);
        }
      }
    }
  }]);
  return Service;
}();