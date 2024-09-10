function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _regeneratorRuntime() { "use strict"; /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/facebook/regenerator/blob/main/LICENSE */ _regeneratorRuntime = function _regeneratorRuntime() { return e; }; var t, e = {}, r = Object.prototype, n = r.hasOwnProperty, o = Object.defineProperty || function (t, e, r) { t[e] = r.value; }, i = "function" == typeof Symbol ? Symbol : {}, a = i.iterator || "@@iterator", c = i.asyncIterator || "@@asyncIterator", u = i.toStringTag || "@@toStringTag"; function define(t, e, r) { return Object.defineProperty(t, e, { value: r, enumerable: !0, configurable: !0, writable: !0 }), t[e]; } try { define({}, ""); } catch (t) { define = function define(t, e, r) { return t[e] = r; }; } function wrap(t, e, r, n) { var i = e && e.prototype instanceof Generator ? e : Generator, a = Object.create(i.prototype), c = new Context(n || []); return o(a, "_invoke", { value: makeInvokeMethod(t, r, c) }), a; } function tryCatch(t, e, r) { try { return { type: "normal", arg: t.call(e, r) }; } catch (t) { return { type: "throw", arg: t }; } } e.wrap = wrap; var h = "suspendedStart", l = "suspendedYield", f = "executing", s = "completed", y = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} var p = {}; define(p, a, function () { return this; }); var d = Object.getPrototypeOf, v = d && d(d(values([]))); v && v !== r && n.call(v, a) && (p = v); var g = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(p); function defineIteratorMethods(t) { ["next", "throw", "return"].forEach(function (e) { define(t, e, function (t) { return this._invoke(e, t); }); }); } function AsyncIterator(t, e) { function invoke(r, o, i, a) { var c = tryCatch(t[r], t, o); if ("throw" !== c.type) { var u = c.arg, h = u.value; return h && "object" == _typeof(h) && n.call(h, "__await") ? e.resolve(h.__await).then(function (t) { invoke("next", t, i, a); }, function (t) { invoke("throw", t, i, a); }) : e.resolve(h).then(function (t) { u.value = t, i(u); }, function (t) { return invoke("throw", t, i, a); }); } a(c.arg); } var r; o(this, "_invoke", { value: function value(t, n) { function callInvokeWithMethodAndArg() { return new e(function (e, r) { invoke(t, n, e, r); }); } return r = r ? r.then(callInvokeWithMethodAndArg, callInvokeWithMethodAndArg) : callInvokeWithMethodAndArg(); } }); } function makeInvokeMethod(e, r, n) { var o = h; return function (i, a) { if (o === f) throw new Error("Generator is already running"); if (o === s) { if ("throw" === i) throw a; return { value: t, done: !0 }; } for (n.method = i, n.arg = a;;) { var c = n.delegate; if (c) { var u = maybeInvokeDelegate(c, n); if (u) { if (u === y) continue; return u; } } if ("next" === n.method) n.sent = n._sent = n.arg;else if ("throw" === n.method) { if (o === h) throw o = s, n.arg; n.dispatchException(n.arg); } else "return" === n.method && n.abrupt("return", n.arg); o = f; var p = tryCatch(e, r, n); if ("normal" === p.type) { if (o = n.done ? s : l, p.arg === y) continue; return { value: p.arg, done: n.done }; } "throw" === p.type && (o = s, n.method = "throw", n.arg = p.arg); } }; } function maybeInvokeDelegate(e, r) { var n = r.method, o = e.iterator[n]; if (o === t) return r.delegate = null, "throw" === n && e.iterator.return && (r.method = "return", r.arg = t, maybeInvokeDelegate(e, r), "throw" === r.method) || "return" !== n && (r.method = "throw", r.arg = new TypeError("The iterator does not provide a '" + n + "' method")), y; var i = tryCatch(o, e.iterator, r.arg); if ("throw" === i.type) return r.method = "throw", r.arg = i.arg, r.delegate = null, y; var a = i.arg; return a ? a.done ? (r[e.resultName] = a.value, r.next = e.nextLoc, "return" !== r.method && (r.method = "next", r.arg = t), r.delegate = null, y) : a : (r.method = "throw", r.arg = new TypeError("iterator result is not an object"), r.delegate = null, y); } function pushTryEntry(t) { var e = { tryLoc: t[0] }; 1 in t && (e.catchLoc = t[1]), 2 in t && (e.finallyLoc = t[2], e.afterLoc = t[3]), this.tryEntries.push(e); } function resetTryEntry(t) { var e = t.completion || {}; e.type = "normal", delete e.arg, t.completion = e; } function Context(t) { this.tryEntries = [{ tryLoc: "root" }], t.forEach(pushTryEntry, this), this.reset(!0); } function values(e) { if (e || "" === e) { var r = e[a]; if (r) return r.call(e); if ("function" == typeof e.next) return e; if (!isNaN(e.length)) { var o = -1, i = function next() { for (; ++o < e.length;) if (n.call(e, o)) return next.value = e[o], next.done = !1, next; return next.value = t, next.done = !0, next; }; return i.next = i; } } throw new TypeError(_typeof(e) + " is not iterable"); } return GeneratorFunction.prototype = GeneratorFunctionPrototype, o(g, "constructor", { value: GeneratorFunctionPrototype, configurable: !0 }), o(GeneratorFunctionPrototype, "constructor", { value: GeneratorFunction, configurable: !0 }), GeneratorFunction.displayName = define(GeneratorFunctionPrototype, u, "GeneratorFunction"), e.isGeneratorFunction = function (t) { var e = "function" == typeof t && t.constructor; return !!e && (e === GeneratorFunction || "GeneratorFunction" === (e.displayName || e.name)); }, e.mark = function (t) { return Object.setPrototypeOf ? Object.setPrototypeOf(t, GeneratorFunctionPrototype) : (t.__proto__ = GeneratorFunctionPrototype, define(t, u, "GeneratorFunction")), t.prototype = Object.create(g), t; }, e.awrap = function (t) { return { __await: t }; }, defineIteratorMethods(AsyncIterator.prototype), define(AsyncIterator.prototype, c, function () { return this; }), e.AsyncIterator = AsyncIterator, e.async = function (t, r, n, o, i) { void 0 === i && (i = Promise); var a = new AsyncIterator(wrap(t, r, n, o), i); return e.isGeneratorFunction(r) ? a : a.next().then(function (t) { return t.done ? t.value : a.next(); }); }, defineIteratorMethods(g), define(g, u, "Generator"), define(g, a, function () { return this; }), define(g, "toString", function () { return "[object Generator]"; }), e.keys = function (t) { var e = Object(t), r = []; for (var n in e) r.push(n); return r.reverse(), function next() { for (; r.length;) { var t = r.pop(); if (t in e) return next.value = t, next.done = !1, next; } return next.done = !0, next; }; }, e.values = values, Context.prototype = { constructor: Context, reset: function reset(e) { if (this.prev = 0, this.next = 0, this.sent = this._sent = t, this.done = !1, this.delegate = null, this.method = "next", this.arg = t, this.tryEntries.forEach(resetTryEntry), !e) for (var r in this) "t" === r.charAt(0) && n.call(this, r) && !isNaN(+r.slice(1)) && (this[r] = t); }, stop: function stop() { this.done = !0; var t = this.tryEntries[0].completion; if ("throw" === t.type) throw t.arg; return this.rval; }, dispatchException: function dispatchException(e) { if (this.done) throw e; var r = this; function handle(n, o) { return a.type = "throw", a.arg = e, r.next = n, o && (r.method = "next", r.arg = t), !!o; } for (var o = this.tryEntries.length - 1; o >= 0; --o) { var i = this.tryEntries[o], a = i.completion; if ("root" === i.tryLoc) return handle("end"); if (i.tryLoc <= this.prev) { var c = n.call(i, "catchLoc"), u = n.call(i, "finallyLoc"); if (c && u) { if (this.prev < i.catchLoc) return handle(i.catchLoc, !0); if (this.prev < i.finallyLoc) return handle(i.finallyLoc); } else if (c) { if (this.prev < i.catchLoc) return handle(i.catchLoc, !0); } else { if (!u) throw new Error("try statement without catch or finally"); if (this.prev < i.finallyLoc) return handle(i.finallyLoc); } } } }, abrupt: function abrupt(t, e) { for (var r = this.tryEntries.length - 1; r >= 0; --r) { var o = this.tryEntries[r]; if (o.tryLoc <= this.prev && n.call(o, "finallyLoc") && this.prev < o.finallyLoc) { var i = o; break; } } i && ("break" === t || "continue" === t) && i.tryLoc <= e && e <= i.finallyLoc && (i = null); var a = i ? i.completion : {}; return a.type = t, a.arg = e, i ? (this.method = "next", this.next = i.finallyLoc, y) : this.complete(a); }, complete: function complete(t, e) { if ("throw" === t.type) throw t.arg; return "break" === t.type || "continue" === t.type ? this.next = t.arg : "return" === t.type ? (this.rval = this.arg = t.arg, this.method = "return", this.next = "end") : "normal" === t.type && e && (this.next = e), y; }, finish: function finish(t) { for (var e = this.tryEntries.length - 1; e >= 0; --e) { var r = this.tryEntries[e]; if (r.finallyLoc === t) return this.complete(r.completion, r.afterLoc), resetTryEntry(r), y; } }, catch: function _catch(t) { for (var e = this.tryEntries.length - 1; e >= 0; --e) { var r = this.tryEntries[e]; if (r.tryLoc === t) { var n = r.completion; if ("throw" === n.type) { var o = n.arg; resetTryEntry(r); } return o; } } throw new Error("illegal catch attempt"); }, delegateYield: function delegateYield(e, r, n) { return this.delegate = { iterator: values(e), resultName: r, nextLoc: n }, "next" === this.method && (this.arg = t), y; } }, e; }
function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }
function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }
function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : String(i); }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
import { chalk, confirm, isDirectory, isPathExistsSync, logger, mkdirSync, removeSync } from '@eljs/utils';
import assert from 'assert';
import { readdirSync } from 'fs';
import path from 'path';
import { Download } from "./download";
import { Generator } from "./generator";
export function objectToArray(obj) {
  var valueIsNumber = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
  return Object.keys(obj).map(function (key) {
    var title = obj[key];
    return {
      title: title,
      value: valueIsNumber ? Number(key) : key
    };
  });
}
var TARGET_DIR_WHITE_LIST = ['.git', 'LICENSE'];
export var Create = /*#__PURE__*/function () {
  function Create(opts) {
    _classCallCheck(this, Create);
    /**
     * 构造函数配置项
     */
    _defineProperty(this, "_opts", void 0);
    /**
     * 当前路径
     */
    _defineProperty(this, "_cwd", process.cwd());
    /**
     * 本地模板路径
     */
    _defineProperty(this, "_localTemplatePath", void 0);
    assert(opts.template || opts.templateInfo, "\u8BF7\u4F20\u5165 `templateInfo` \u6216\u8005 `template`");
    this._opts = opts;
    if (opts.cwd) {
      this._cwd = opts.cwd;
    }
    this._ensureLocalTemplate(this._opts.template);
  }
  _createClass(Create, [{
    key: "cwd",
    get: function get() {
      return this._cwd;
    }
  }, {
    key: "templateInfo",
    get: function get() {
      return this._opts.templateInfo;
    }
  }, {
    key: "run",
    value: function () {
      var _run = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee(projectName) {
        var templatePath, name, targetDir, override, generator;
        return _regeneratorRuntime().wrap(function _callee$(_context) {
          while (1) switch (_context.prev = _context.next) {
            case 0:
              templatePath = '';
              _context.prev = 1;
              name = projectName === '.' ? path.relative('../', this.cwd) : projectName;
              targetDir = path.resolve(this.cwd, projectName);
              if (isPathExistsSync(targetDir)) {
                _context.next = 8;
                break;
              }
              mkdirSync(targetDir);
              _context.next = 13;
              break;
            case 8:
              _context.next = 10;
              return this._checkTargetDir(targetDir);
            case 10:
              override = _context.sent;
              if (override) {
                _context.next = 13;
                break;
              }
              return _context.abrupt("return");
            case 13:
              _context.next = 15;
              return this._getTemplatePath();
            case 15:
              templatePath = _context.sent;
              generator = new Generator({
                isLocalTemplate: !!this._localTemplatePath,
                projectName: name,
                targetDir: targetDir,
                args: this._opts.args
              });
              _context.next = 19;
              return generator.create(templatePath);
            case 19:
              _context.next = 26;
              break;
            case 21:
              _context.prev = 21;
              _context.t0 = _context["catch"](1);
              console.log();
              logger.error('创建模版失败，错误信息如下：');
              throw _context.t0;
            case 26:
              _context.prev = 26;
              this._removeTemplate(templatePath);
              return _context.finish(26);
            case 29:
            case "end":
              return _context.stop();
          }
        }, _callee, this, [[1, 21, 26, 29]]);
      }));
      function run(_x) {
        return _run.apply(this, arguments);
      }
      return run;
    }()
  }, {
    key: "_ensureLocalTemplate",
    value: function () {
      var _ensureLocalTemplate2 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee2(localTemplatePath) {
        return _regeneratorRuntime().wrap(function _callee2$(_context2) {
          while (1) switch (_context2.prev = _context2.next) {
            case 0:
              if (localTemplatePath) {
                _context2.next = 2;
                break;
              }
              return _context2.abrupt("return");
            case 2:
              this._localTemplatePath = path.join(this._cwd, localTemplatePath);
              assert(isPathExistsSync(this._localTemplatePath), "\u4F20\u5165\u7684\u81EA\u5B9A\u4E49\u6A21\u677F ".concat(chalk.cyan(this._localTemplatePath), " \u4E0D\u5B58\u5728, \u8BF7\u68C0\u67E5\u8F93\u5165"));
              assert(isDirectory(this._localTemplatePath), "\u4F20\u5165\u7684\u81EA\u5B9A\u4E49\u6A21\u677F ".concat(chalk.cyan(this._localTemplatePath), " \u4E0D\u662F\u4E00\u4E2A\u6587\u4EF6\u76EE\u5F55, \u8BF7\u68C0\u67E5\u8F93\u5165"));
            case 5:
            case "end":
              return _context2.stop();
          }
        }, _callee2, this);
      }));
      function _ensureLocalTemplate(_x2) {
        return _ensureLocalTemplate2.apply(this, arguments);
      }
      return _ensureLocalTemplate;
    }()
  }, {
    key: "_checkTargetDir",
    value: function _checkTargetDir(targetDir) {
      if (this._opts.force) {
        return true;
      }
      var files = readdirSync(targetDir).filter(function (file) {
        return !TARGET_DIR_WHITE_LIST.includes(file);
      });
      if (files.length) {
        logger.warn("\u5F53\u524D\u6587\u4EF6\u5939 ".concat(chalk.bold(targetDir), " \u5B58\u5728\u5982\u4E0B\u6587\u4EF6:\n"));
        files.forEach(function (file) {
          return console.log(' - ' + file);
        });
        console.log();
        return confirm("\u786E\u5B9A\u8981\u8986\u76D6\u5F53\u524D\u6587\u4EF6\u5939\u5417?", true);
      }
      return true;
    }
  }, {
    key: "_getTemplatePath",
    value: function () {
      var _getTemplatePath2 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee3() {
        var download;
        return _regeneratorRuntime().wrap(function _callee3$(_context3) {
          while (1) switch (_context3.prev = _context3.next) {
            case 0:
              if (!this._localTemplatePath) {
                _context3.next = 2;
                break;
              }
              return _context3.abrupt("return", this._localTemplatePath);
            case 2:
              download = new Download(this.templateInfo);
              return _context3.abrupt("return", download.download());
            case 4:
            case "end":
              return _context3.stop();
          }
        }, _callee3, this);
      }));
      function _getTemplatePath() {
        return _getTemplatePath2.apply(this, arguments);
      }
      return _getTemplatePath;
    }()
  }, {
    key: "_removeTemplate",
    value: function _removeTemplate(templatePath) {
      if (!this._localTemplatePath && isPathExistsSync(templatePath)) {
        removeSync(templatePath);
      }
    }
  }]);
  return Create;
}();