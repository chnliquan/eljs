function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _regeneratorRuntime() { "use strict"; /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/facebook/regenerator/blob/main/LICENSE */ _regeneratorRuntime = function _regeneratorRuntime() { return e; }; var t, e = {}, r = Object.prototype, n = r.hasOwnProperty, o = Object.defineProperty || function (t, e, r) { t[e] = r.value; }, i = "function" == typeof Symbol ? Symbol : {}, a = i.iterator || "@@iterator", c = i.asyncIterator || "@@asyncIterator", u = i.toStringTag || "@@toStringTag"; function define(t, e, r) { return Object.defineProperty(t, e, { value: r, enumerable: !0, configurable: !0, writable: !0 }), t[e]; } try { define({}, ""); } catch (t) { define = function define(t, e, r) { return t[e] = r; }; } function wrap(t, e, r, n) { var i = e && e.prototype instanceof Generator ? e : Generator, a = Object.create(i.prototype), c = new Context(n || []); return o(a, "_invoke", { value: makeInvokeMethod(t, r, c) }), a; } function tryCatch(t, e, r) { try { return { type: "normal", arg: t.call(e, r) }; } catch (t) { return { type: "throw", arg: t }; } } e.wrap = wrap; var h = "suspendedStart", l = "suspendedYield", f = "executing", s = "completed", y = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} var p = {}; define(p, a, function () { return this; }); var d = Object.getPrototypeOf, v = d && d(d(values([]))); v && v !== r && n.call(v, a) && (p = v); var g = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(p); function defineIteratorMethods(t) { ["next", "throw", "return"].forEach(function (e) { define(t, e, function (t) { return this._invoke(e, t); }); }); } function AsyncIterator(t, e) { function invoke(r, o, i, a) { var c = tryCatch(t[r], t, o); if ("throw" !== c.type) { var u = c.arg, h = u.value; return h && "object" == _typeof(h) && n.call(h, "__await") ? e.resolve(h.__await).then(function (t) { invoke("next", t, i, a); }, function (t) { invoke("throw", t, i, a); }) : e.resolve(h).then(function (t) { u.value = t, i(u); }, function (t) { return invoke("throw", t, i, a); }); } a(c.arg); } var r; o(this, "_invoke", { value: function value(t, n) { function callInvokeWithMethodAndArg() { return new e(function (e, r) { invoke(t, n, e, r); }); } return r = r ? r.then(callInvokeWithMethodAndArg, callInvokeWithMethodAndArg) : callInvokeWithMethodAndArg(); } }); } function makeInvokeMethod(e, r, n) { var o = h; return function (i, a) { if (o === f) throw new Error("Generator is already running"); if (o === s) { if ("throw" === i) throw a; return { value: t, done: !0 }; } for (n.method = i, n.arg = a;;) { var c = n.delegate; if (c) { var u = maybeInvokeDelegate(c, n); if (u) { if (u === y) continue; return u; } } if ("next" === n.method) n.sent = n._sent = n.arg;else if ("throw" === n.method) { if (o === h) throw o = s, n.arg; n.dispatchException(n.arg); } else "return" === n.method && n.abrupt("return", n.arg); o = f; var p = tryCatch(e, r, n); if ("normal" === p.type) { if (o = n.done ? s : l, p.arg === y) continue; return { value: p.arg, done: n.done }; } "throw" === p.type && (o = s, n.method = "throw", n.arg = p.arg); } }; } function maybeInvokeDelegate(e, r) { var n = r.method, o = e.iterator[n]; if (o === t) return r.delegate = null, "throw" === n && e.iterator.return && (r.method = "return", r.arg = t, maybeInvokeDelegate(e, r), "throw" === r.method) || "return" !== n && (r.method = "throw", r.arg = new TypeError("The iterator does not provide a '" + n + "' method")), y; var i = tryCatch(o, e.iterator, r.arg); if ("throw" === i.type) return r.method = "throw", r.arg = i.arg, r.delegate = null, y; var a = i.arg; return a ? a.done ? (r[e.resultName] = a.value, r.next = e.nextLoc, "return" !== r.method && (r.method = "next", r.arg = t), r.delegate = null, y) : a : (r.method = "throw", r.arg = new TypeError("iterator result is not an object"), r.delegate = null, y); } function pushTryEntry(t) { var e = { tryLoc: t[0] }; 1 in t && (e.catchLoc = t[1]), 2 in t && (e.finallyLoc = t[2], e.afterLoc = t[3]), this.tryEntries.push(e); } function resetTryEntry(t) { var e = t.completion || {}; e.type = "normal", delete e.arg, t.completion = e; } function Context(t) { this.tryEntries = [{ tryLoc: "root" }], t.forEach(pushTryEntry, this), this.reset(!0); } function values(e) { if (e || "" === e) { var r = e[a]; if (r) return r.call(e); if ("function" == typeof e.next) return e; if (!isNaN(e.length)) { var o = -1, i = function next() { for (; ++o < e.length;) if (n.call(e, o)) return next.value = e[o], next.done = !1, next; return next.value = t, next.done = !0, next; }; return i.next = i; } } throw new TypeError(_typeof(e) + " is not iterable"); } return GeneratorFunction.prototype = GeneratorFunctionPrototype, o(g, "constructor", { value: GeneratorFunctionPrototype, configurable: !0 }), o(GeneratorFunctionPrototype, "constructor", { value: GeneratorFunction, configurable: !0 }), GeneratorFunction.displayName = define(GeneratorFunctionPrototype, u, "GeneratorFunction"), e.isGeneratorFunction = function (t) { var e = "function" == typeof t && t.constructor; return !!e && (e === GeneratorFunction || "GeneratorFunction" === (e.displayName || e.name)); }, e.mark = function (t) { return Object.setPrototypeOf ? Object.setPrototypeOf(t, GeneratorFunctionPrototype) : (t.__proto__ = GeneratorFunctionPrototype, define(t, u, "GeneratorFunction")), t.prototype = Object.create(g), t; }, e.awrap = function (t) { return { __await: t }; }, defineIteratorMethods(AsyncIterator.prototype), define(AsyncIterator.prototype, c, function () { return this; }), e.AsyncIterator = AsyncIterator, e.async = function (t, r, n, o, i) { void 0 === i && (i = Promise); var a = new AsyncIterator(wrap(t, r, n, o), i); return e.isGeneratorFunction(r) ? a : a.next().then(function (t) { return t.done ? t.value : a.next(); }); }, defineIteratorMethods(g), define(g, u, "Generator"), define(g, a, function () { return this; }), define(g, "toString", function () { return "[object Generator]"; }), e.keys = function (t) { var e = Object(t), r = []; for (var n in e) r.push(n); return r.reverse(), function next() { for (; r.length;) { var t = r.pop(); if (t in e) return next.value = t, next.done = !1, next; } return next.done = !0, next; }; }, e.values = values, Context.prototype = { constructor: Context, reset: function reset(e) { if (this.prev = 0, this.next = 0, this.sent = this._sent = t, this.done = !1, this.delegate = null, this.method = "next", this.arg = t, this.tryEntries.forEach(resetTryEntry), !e) for (var r in this) "t" === r.charAt(0) && n.call(this, r) && !isNaN(+r.slice(1)) && (this[r] = t); }, stop: function stop() { this.done = !0; var t = this.tryEntries[0].completion; if ("throw" === t.type) throw t.arg; return this.rval; }, dispatchException: function dispatchException(e) { if (this.done) throw e; var r = this; function handle(n, o) { return a.type = "throw", a.arg = e, r.next = n, o && (r.method = "next", r.arg = t), !!o; } for (var o = this.tryEntries.length - 1; o >= 0; --o) { var i = this.tryEntries[o], a = i.completion; if ("root" === i.tryLoc) return handle("end"); if (i.tryLoc <= this.prev) { var c = n.call(i, "catchLoc"), u = n.call(i, "finallyLoc"); if (c && u) { if (this.prev < i.catchLoc) return handle(i.catchLoc, !0); if (this.prev < i.finallyLoc) return handle(i.finallyLoc); } else if (c) { if (this.prev < i.catchLoc) return handle(i.catchLoc, !0); } else { if (!u) throw new Error("try statement without catch or finally"); if (this.prev < i.finallyLoc) return handle(i.finallyLoc); } } } }, abrupt: function abrupt(t, e) { for (var r = this.tryEntries.length - 1; r >= 0; --r) { var o = this.tryEntries[r]; if (o.tryLoc <= this.prev && n.call(o, "finallyLoc") && this.prev < o.finallyLoc) { var i = o; break; } } i && ("break" === t || "continue" === t) && i.tryLoc <= e && e <= i.finallyLoc && (i = null); var a = i ? i.completion : {}; return a.type = t, a.arg = e, i ? (this.method = "next", this.next = i.finallyLoc, y) : this.complete(a); }, complete: function complete(t, e) { if ("throw" === t.type) throw t.arg; return "break" === t.type || "continue" === t.type ? this.next = t.arg : "return" === t.type ? (this.rval = this.arg = t.arg, this.method = "return", this.next = "end") : "normal" === t.type && e && (this.next = e), y; }, finish: function finish(t) { for (var e = this.tryEntries.length - 1; e >= 0; --e) { var r = this.tryEntries[e]; if (r.finallyLoc === t) return this.complete(r.completion, r.afterLoc), resetTryEntry(r), y; } }, catch: function _catch(t) { for (var e = this.tryEntries.length - 1; e >= 0; --e) { var r = this.tryEntries[e]; if (r.tryLoc === t) { var n = r.completion; if ("throw" === n.type) { var o = n.arg; resetTryEntry(r); } return o; } } throw new Error("illegal catch attempt"); }, delegateYield: function delegateYield(e, r, n) { return this.delegate = { iterator: values(e), resultName: r, nextLoc: n }, "next" === this.method && (this.arg = t), y; } }, e; }
function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }
function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }
import { VERSION_TAGS } from "../constants";
import { chalk, logger, pascalCase, prompts } from '@eljs/utils';
import semver from 'semver';
import { getDistTag, getReferenceVersion, getVersion, isVersionExist } from "./version";
function getPreVersionPromptQuestions(referenceVersion, tag) {
  return {
    name: 'value',
    type: 'select',
    message: "Please select the ".concat(tag, " version to bump:"),
    choices: ['prerelease', 'prepatch', 'preminor', 'premajor'].map(function (item) {
      var version = getVersion({
        referenceVersion: referenceVersion,
        targetVersion: item,
        tag: tag
      });
      return {
        title: "".concat(item === 'prerelease' ? pascalCase(item) : pascalCase(item) + '  ', " (").concat(version, ")"),
        value: version
      };
    })
  };
}
export function getBumpVersion(_x) {
  return _getBumpVersion.apply(this, arguments);
}
function _getBumpVersion() {
  _getBumpVersion = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee(opts) {
    var cwd, pkgJSON, publishPkgNames, tag, targetVersion, localVersion, _yield$getDistTag, remoteLatestVersion, remoteAlphaVersion, remoteBetaVersion, remoteNextVersion, latestReferenceVersion, alphaReferenceVersion, betaReferenceVersion, nextReferenceVersion, tag2referenceVersionMap, isExist, patchVersion, minorVersion, majorVersion, choices, answer, onCancel, referenceVersion, _referenceVersion;
    return _regeneratorRuntime().wrap(function _callee$(_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          cwd = opts.cwd, pkgJSON = opts.pkgJSON, publishPkgNames = opts.publishPkgNames, tag = opts.tag, targetVersion = opts.targetVersion;
          localVersion = pkgJSON.version;
          _context.next = 4;
          return getDistTag(publishPkgNames, cwd);
        case 4:
          _yield$getDistTag = _context.sent;
          remoteLatestVersion = _yield$getDistTag.remoteLatestVersion;
          remoteAlphaVersion = _yield$getDistTag.remoteAlphaVersion;
          remoteBetaVersion = _yield$getDistTag.remoteBetaVersion;
          remoteNextVersion = _yield$getDistTag.remoteNextVersion;
          latestReferenceVersion = getReferenceVersion(localVersion, remoteLatestVersion);
          alphaReferenceVersion = getReferenceVersion(localVersion, remoteAlphaVersion || remoteLatestVersion);
          betaReferenceVersion = getReferenceVersion(localVersion, remoteBetaVersion || remoteLatestVersion);
          nextReferenceVersion = getReferenceVersion(localVersion, remoteNextVersion || remoteLatestVersion);
          tag2referenceVersionMap = {
            alpha: alphaReferenceVersion,
            beta: betaReferenceVersion,
            next: nextReferenceVersion,
            latest: latestReferenceVersion
          };
          logger.info("- Local version: ".concat(chalk.cyanBright.bold(localVersion)));
          if (remoteLatestVersion) {
            logger.info("- Remote latest version: ".concat(chalk.cyanBright.bold(remoteLatestVersion)));
          }
          if (remoteAlphaVersion && (!tag || tag === 'alpha')) {
            logger.info("- Remote alpha version: ".concat(chalk.cyanBright.bold(remoteAlphaVersion)));
          }
          if (remoteBetaVersion && (!tag || tag === 'beta')) {
            logger.info("- Remote beta version: ".concat(chalk.cyanBright.bold(remoteBetaVersion)));
          }
          if (remoteNextVersion && (!tag || tag === 'next')) {
            logger.info("- Remote next version: ".concat(chalk.cyanBright.bold(remoteNextVersion)));
          }
          console.log();
          if (!targetVersion) {
            _context.next = 34;
            break;
          }
          if (!VERSION_TAGS.includes(targetVersion)) {
            _context.next = 25;
            break;
          }
          return _context.abrupt("return", getVersion({
            targetVersion: targetVersion,
            referenceVersion: tag ? tag2referenceVersionMap[tag] : latestReferenceVersion,
            tag: tag
          }));
        case 25:
          if (!semver.valid(targetVersion)) {
            logger.printErrorAndExit("".concat(publishPkgNames[0], " has already published v").concat(chalk.bold(targetVersion), "."));
          }
          _context.next = 28;
          return isVersionExist(publishPkgNames[0], targetVersion);
        case 28:
          isExist = _context.sent;
          if (!isExist) {
            _context.next = 33;
            break;
          }
          logger.printErrorAndExit("".concat(publishPkgNames[0], " has already published v").concat(chalk.bold(targetVersion), "."));
          _context.next = 34;
          break;
        case 33:
          return _context.abrupt("return", targetVersion);
        case 34:
          patchVersion = getVersion({
            referenceVersion: latestReferenceVersion,
            targetVersion: 'patch'
          });
          minorVersion = getVersion({
            referenceVersion: latestReferenceVersion,
            targetVersion: 'minor'
          });
          majorVersion = getVersion({
            referenceVersion: latestReferenceVersion,
            targetVersion: 'major'
          });
          choices = [{
            title: "Patch (".concat(patchVersion, ")"),
            value: patchVersion,
            description: chalk.grey("Bug Fix")
          }, {
            title: "Minor (".concat(minorVersion, ")"),
            value: minorVersion,
            description: chalk.grey("New Feature")
          }, {
            title: "Major (".concat(majorVersion, ")"),
            value: majorVersion,
            description: chalk.grey("Breaking Change")
          }, {
            title: "Alpha",
            value: 'alpha',
            description: chalk.grey("Internal Test Version")
          }, {
            title: "Beta",
            value: 'beta',
            description: chalk.grey("External Test Version")
          }, {
            title: "Next",
            value: 'next',
            description: chalk.grey("Candidate Version")
          }];
          answer = {
            value: ''
          };
          onCancel = function onCancel() {
            process.exit(1);
          };
          if (tag) {
            _context.next = 51;
            break;
          }
          _context.next = 43;
          return prompts([{
            name: 'value',
            type: 'select',
            message: 'Please select the version to bump:',
            choices: choices
          }], {
            onCancel: onCancel
          });
        case 43:
          answer = _context.sent;
          if (!['alpha', 'beta', 'next'].includes(answer.value)) {
            _context.next = 49;
            break;
          }
          referenceVersion = tag2referenceVersionMap[answer.value];
          _context.next = 48;
          return prompts(getPreVersionPromptQuestions(referenceVersion, answer.value), {
            onCancel: onCancel
          });
        case 48:
          answer = _context.sent;
        case 49:
          _context.next = 61;
          break;
        case 51:
          if (!(tag === 'latest')) {
            _context.next = 57;
            break;
          }
          _context.next = 54;
          return prompts([{
            name: 'value',
            type: 'select',
            message: 'Please select the version to bump:',
            choices: choices.slice(0, 3)
          }], {
            onCancel: onCancel
          });
        case 54:
          answer = _context.sent;
          _context.next = 61;
          break;
        case 57:
          _referenceVersion = tag2referenceVersionMap[tag];
          _context.next = 60;
          return prompts(getPreVersionPromptQuestions(_referenceVersion, tag), {
            onCancel: onCancel
          });
        case 60:
          answer = _context.sent;
        case 61:
          return _context.abrupt("return", answer.value);
        case 62:
        case "end":
          return _context.stop();
      }
    }, _callee);
  }));
  return _getBumpVersion.apply(this, arguments);
}