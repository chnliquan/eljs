function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _regeneratorRuntime() { "use strict"; /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/facebook/regenerator/blob/main/LICENSE */ _regeneratorRuntime = function _regeneratorRuntime() { return e; }; var t, e = {}, r = Object.prototype, n = r.hasOwnProperty, o = Object.defineProperty || function (t, e, r) { t[e] = r.value; }, i = "function" == typeof Symbol ? Symbol : {}, a = i.iterator || "@@iterator", c = i.asyncIterator || "@@asyncIterator", u = i.toStringTag || "@@toStringTag"; function define(t, e, r) { return Object.defineProperty(t, e, { value: r, enumerable: !0, configurable: !0, writable: !0 }), t[e]; } try { define({}, ""); } catch (t) { define = function define(t, e, r) { return t[e] = r; }; } function wrap(t, e, r, n) { var i = e && e.prototype instanceof Generator ? e : Generator, a = Object.create(i.prototype), c = new Context(n || []); return o(a, "_invoke", { value: makeInvokeMethod(t, r, c) }), a; } function tryCatch(t, e, r) { try { return { type: "normal", arg: t.call(e, r) }; } catch (t) { return { type: "throw", arg: t }; } } e.wrap = wrap; var h = "suspendedStart", l = "suspendedYield", f = "executing", s = "completed", y = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} var p = {}; define(p, a, function () { return this; }); var d = Object.getPrototypeOf, v = d && d(d(values([]))); v && v !== r && n.call(v, a) && (p = v); var g = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(p); function defineIteratorMethods(t) { ["next", "throw", "return"].forEach(function (e) { define(t, e, function (t) { return this._invoke(e, t); }); }); } function AsyncIterator(t, e) { function invoke(r, o, i, a) { var c = tryCatch(t[r], t, o); if ("throw" !== c.type) { var u = c.arg, h = u.value; return h && "object" == _typeof(h) && n.call(h, "__await") ? e.resolve(h.__await).then(function (t) { invoke("next", t, i, a); }, function (t) { invoke("throw", t, i, a); }) : e.resolve(h).then(function (t) { u.value = t, i(u); }, function (t) { return invoke("throw", t, i, a); }); } a(c.arg); } var r; o(this, "_invoke", { value: function value(t, n) { function callInvokeWithMethodAndArg() { return new e(function (e, r) { invoke(t, n, e, r); }); } return r = r ? r.then(callInvokeWithMethodAndArg, callInvokeWithMethodAndArg) : callInvokeWithMethodAndArg(); } }); } function makeInvokeMethod(e, r, n) { var o = h; return function (i, a) { if (o === f) throw new Error("Generator is already running"); if (o === s) { if ("throw" === i) throw a; return { value: t, done: !0 }; } for (n.method = i, n.arg = a;;) { var c = n.delegate; if (c) { var u = maybeInvokeDelegate(c, n); if (u) { if (u === y) continue; return u; } } if ("next" === n.method) n.sent = n._sent = n.arg;else if ("throw" === n.method) { if (o === h) throw o = s, n.arg; n.dispatchException(n.arg); } else "return" === n.method && n.abrupt("return", n.arg); o = f; var p = tryCatch(e, r, n); if ("normal" === p.type) { if (o = n.done ? s : l, p.arg === y) continue; return { value: p.arg, done: n.done }; } "throw" === p.type && (o = s, n.method = "throw", n.arg = p.arg); } }; } function maybeInvokeDelegate(e, r) { var n = r.method, o = e.iterator[n]; if (o === t) return r.delegate = null, "throw" === n && e.iterator.return && (r.method = "return", r.arg = t, maybeInvokeDelegate(e, r), "throw" === r.method) || "return" !== n && (r.method = "throw", r.arg = new TypeError("The iterator does not provide a '" + n + "' method")), y; var i = tryCatch(o, e.iterator, r.arg); if ("throw" === i.type) return r.method = "throw", r.arg = i.arg, r.delegate = null, y; var a = i.arg; return a ? a.done ? (r[e.resultName] = a.value, r.next = e.nextLoc, "return" !== r.method && (r.method = "next", r.arg = t), r.delegate = null, y) : a : (r.method = "throw", r.arg = new TypeError("iterator result is not an object"), r.delegate = null, y); } function pushTryEntry(t) { var e = { tryLoc: t[0] }; 1 in t && (e.catchLoc = t[1]), 2 in t && (e.finallyLoc = t[2], e.afterLoc = t[3]), this.tryEntries.push(e); } function resetTryEntry(t) { var e = t.completion || {}; e.type = "normal", delete e.arg, t.completion = e; } function Context(t) { this.tryEntries = [{ tryLoc: "root" }], t.forEach(pushTryEntry, this), this.reset(!0); } function values(e) { if (e || "" === e) { var r = e[a]; if (r) return r.call(e); if ("function" == typeof e.next) return e; if (!isNaN(e.length)) { var o = -1, i = function next() { for (; ++o < e.length;) if (n.call(e, o)) return next.value = e[o], next.done = !1, next; return next.value = t, next.done = !0, next; }; return i.next = i; } } throw new TypeError(_typeof(e) + " is not iterable"); } return GeneratorFunction.prototype = GeneratorFunctionPrototype, o(g, "constructor", { value: GeneratorFunctionPrototype, configurable: !0 }), o(GeneratorFunctionPrototype, "constructor", { value: GeneratorFunction, configurable: !0 }), GeneratorFunction.displayName = define(GeneratorFunctionPrototype, u, "GeneratorFunction"), e.isGeneratorFunction = function (t) { var e = "function" == typeof t && t.constructor; return !!e && (e === GeneratorFunction || "GeneratorFunction" === (e.displayName || e.name)); }, e.mark = function (t) { return Object.setPrototypeOf ? Object.setPrototypeOf(t, GeneratorFunctionPrototype) : (t.__proto__ = GeneratorFunctionPrototype, define(t, u, "GeneratorFunction")), t.prototype = Object.create(g), t; }, e.awrap = function (t) { return { __await: t }; }, defineIteratorMethods(AsyncIterator.prototype), define(AsyncIterator.prototype, c, function () { return this; }), e.AsyncIterator = AsyncIterator, e.async = function (t, r, n, o, i) { void 0 === i && (i = Promise); var a = new AsyncIterator(wrap(t, r, n, o), i); return e.isGeneratorFunction(r) ? a : a.next().then(function (t) { return t.done ? t.value : a.next(); }); }, defineIteratorMethods(g), define(g, u, "Generator"), define(g, a, function () { return this; }), define(g, "toString", function () { return "[object Generator]"; }), e.keys = function (t) { var e = Object(t), r = []; for (var n in e) r.push(n); return r.reverse(), function next() { for (; r.length;) { var t = r.pop(); if (t in e) return next.value = t, next.done = !1, next; } return next.done = !0, next; }; }, e.values = values, Context.prototype = { constructor: Context, reset: function reset(e) { if (this.prev = 0, this.next = 0, this.sent = this._sent = t, this.done = !1, this.delegate = null, this.method = "next", this.arg = t, this.tryEntries.forEach(resetTryEntry), !e) for (var r in this) "t" === r.charAt(0) && n.call(this, r) && !isNaN(+r.slice(1)) && (this[r] = t); }, stop: function stop() { this.done = !0; var t = this.tryEntries[0].completion; if ("throw" === t.type) throw t.arg; return this.rval; }, dispatchException: function dispatchException(e) { if (this.done) throw e; var r = this; function handle(n, o) { return a.type = "throw", a.arg = e, r.next = n, o && (r.method = "next", r.arg = t), !!o; } for (var o = this.tryEntries.length - 1; o >= 0; --o) { var i = this.tryEntries[o], a = i.completion; if ("root" === i.tryLoc) return handle("end"); if (i.tryLoc <= this.prev) { var c = n.call(i, "catchLoc"), u = n.call(i, "finallyLoc"); if (c && u) { if (this.prev < i.catchLoc) return handle(i.catchLoc, !0); if (this.prev < i.finallyLoc) return handle(i.finallyLoc); } else if (c) { if (this.prev < i.catchLoc) return handle(i.catchLoc, !0); } else { if (!u) throw new Error("try statement without catch or finally"); if (this.prev < i.finallyLoc) return handle(i.finallyLoc); } } } }, abrupt: function abrupt(t, e) { for (var r = this.tryEntries.length - 1; r >= 0; --r) { var o = this.tryEntries[r]; if (o.tryLoc <= this.prev && n.call(o, "finallyLoc") && this.prev < o.finallyLoc) { var i = o; break; } } i && ("break" === t || "continue" === t) && i.tryLoc <= e && e <= i.finallyLoc && (i = null); var a = i ? i.completion : {}; return a.type = t, a.arg = e, i ? (this.method = "next", this.next = i.finallyLoc, y) : this.complete(a); }, complete: function complete(t, e) { if ("throw" === t.type) throw t.arg; return "break" === t.type || "continue" === t.type ? this.next = t.arg : "return" === t.type ? (this.rval = this.arg = t.arg, this.method = "return", this.next = "end") : "normal" === t.type && e && (this.next = e), y; }, finish: function finish(t) { for (var e = this.tryEntries.length - 1; e >= 0; --e) { var r = this.tryEntries[e]; if (r.finallyLoc === t) return this.complete(r.completion, r.afterLoc), resetTryEntry(r), y; } }, catch: function _catch(t) { for (var e = this.tryEntries.length - 1; e >= 0; --e) { var r = this.tryEntries[e]; if (r.tryLoc === t) { var n = r.completion; if ("throw" === n.type) { var o = n.arg; resetTryEntry(r); } return o; } } throw new Error("illegal catch attempt"); }, delegateYield: function delegateYield(e, r, n) { return this.delegate = { iterator: values(e), resultName: r, nextLoc: n }, "next" === this.method && (this.arg = t), y; } }, e; }
function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }
function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }
import { chalk, isGitBehindRemote, isGitBranch, isGitClean, logger } from '@eljs/utils';
import path from 'path';
import { getBumpVersion, step } from "../utils";
import { generateChangelog } from "./changelog";
import { commit } from "./commit";
import { init } from "./init";
import { checkOwnership } from "./ownership";
import { publish } from "./publish";
import { reconfirm } from "./reconfirm";
import { checkRegistry } from "./registry";
import { sync } from "./sync";
import { updateLock, updateVersions } from "./update";

/**
 * Workflow
 *
 * 1. Make changes
 * 2. Commit those changes
 * 3. Make sure Travis turns green
 * 4. Bump version in package.json
 * 5. conventionalChangelog
 * 6. Commit package.json and CHANGELOG.md files
 * 7. Tag
 * 8. Push
 */
export function release(_x) {
  return _release.apply(this, arguments);
}
function _release() {
  _release = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee(opts) {
    var _rootPkgJSON$reposito;
    var _opts$cwd, cwd, _opts$dry, dry, _opts$verbose, verbose, _opts$latest, latest, _opts$publishOnly, publishOnly, _opts$syncCnpm, syncCnpm, _opts$confirm, confirm, _opts$registryCheck, registryCheck, _opts$ownershipCheck, ownershipCheck, _opts$gitCheck, gitCheck, _opts$gitPush, gitPush, _opts$githubRelease, githubRelease, _opts$branch, branch, tag, customRepoType, _opts$changelogPreset, changelogPreset, version, beforeUpdateVersion, beforeChangelog, _yield$init, rootPkgJSONPath, rootPkgJSON, pkgNames, pkgJSONPaths, pkgJSONs, publishPkgDirs, publishPkgNames, repoUrl, repoType, _rootPkgJSON$publishC, maxPadLength, bumpVersion, changelog;
    return _regeneratorRuntime().wrap(function _callee$(_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          _opts$cwd = opts.cwd, cwd = _opts$cwd === void 0 ? process.cwd() : _opts$cwd, _opts$dry = opts.dry, dry = _opts$dry === void 0 ? false : _opts$dry, _opts$verbose = opts.verbose, verbose = _opts$verbose === void 0 ? false : _opts$verbose, _opts$latest = opts.latest, latest = _opts$latest === void 0 ? true : _opts$latest, _opts$publishOnly = opts.publishOnly, publishOnly = _opts$publishOnly === void 0 ? false : _opts$publishOnly, _opts$syncCnpm = opts.syncCnpm, syncCnpm = _opts$syncCnpm === void 0 ? false : _opts$syncCnpm, _opts$confirm = opts.confirm, confirm = _opts$confirm === void 0 ? true : _opts$confirm, _opts$registryCheck = opts.registryCheck, registryCheck = _opts$registryCheck === void 0 ? true : _opts$registryCheck, _opts$ownershipCheck = opts.ownershipCheck, ownershipCheck = _opts$ownershipCheck === void 0 ? true : _opts$ownershipCheck, _opts$gitCheck = opts.gitCheck, gitCheck = _opts$gitCheck === void 0 ? true : _opts$gitCheck, _opts$gitPush = opts.gitPush, gitPush = _opts$gitPush === void 0 ? true : _opts$gitPush, _opts$githubRelease = opts.githubRelease, githubRelease = _opts$githubRelease === void 0 ? true : _opts$githubRelease, _opts$branch = opts.branch, branch = _opts$branch === void 0 ? '' : _opts$branch, tag = opts.tag, customRepoType = opts.repoType, _opts$changelogPreset = opts.changelogPreset, changelogPreset = _opts$changelogPreset === void 0 ? '@eljs/changelog-preset' : _opts$changelogPreset, version = opts.version, beforeUpdateVersion = opts.beforeUpdateVersion, beforeChangelog = opts.beforeChangelog; // check git status
          if (!gitCheck) {
            _context.next = 11;
            break;
          }
          step('Checking git ...');
          _context.next = 5;
          return isGitClean(cwd);
        case 5:
          if (_context.sent) {
            _context.next = 7;
            break;
          }
          logger.printErrorAndExit('git is not clean.');
        case 7:
          _context.next = 9;
          return isGitBehindRemote(cwd);
        case 9:
          if (!_context.sent) {
            _context.next = 11;
            break;
          }
          logger.printErrorAndExit('git is behind remote.');
        case 11:
          if (!branch) {
            _context.next = 17;
            break;
          }
          step('Checking branch ...');
          _context.next = 15;
          return isGitBranch(branch, cwd);
        case 15:
          if (_context.sent) {
            _context.next = 17;
            break;
          }
          logger.printErrorAndExit("current branch does not match branch ".concat(branch, "."));
        case 17:
          _context.next = 19;
          return init(cwd);
        case 19:
          _yield$init = _context.sent;
          rootPkgJSONPath = _yield$init.rootPkgJSONPath;
          rootPkgJSON = _yield$init.rootPkgJSON;
          pkgNames = _yield$init.pkgNames;
          pkgJSONPaths = _yield$init.pkgJSONPaths;
          pkgJSONs = _yield$init.pkgJSONs;
          publishPkgDirs = _yield$init.publishPkgDirs;
          publishPkgNames = _yield$init.publishPkgNames;
          repoUrl = (rootPkgJSON === null || rootPkgJSON === void 0 || (_rootPkgJSON$reposito = rootPkgJSON.repository) === null || _rootPkgJSON$reposito === void 0 ? void 0 : _rootPkgJSON$reposito.url) || '';
          repoType = customRepoType || (repoUrl !== null && repoUrl !== void 0 && repoUrl.includes('github') ? 'github' : 'gitlab'); // check npm registry
          if (!(registryCheck && !dry)) {
            _context.next = 33;
            break;
          }
          step('Checking registry ...');
          _context.next = 33;
          return checkRegistry({
            cwd: cwd,
            repoType: repoType,
            repoUrl: repoUrl,
            pkgRegistry: rootPkgJSON === null || rootPkgJSON === void 0 || (_rootPkgJSON$publishC = rootPkgJSON.publishConfig) === null || _rootPkgJSON$publishC === void 0 ? void 0 : _rootPkgJSON$publishC.registry
          });
        case 33:
          if (!(ownershipCheck && !dry)) {
            _context.next = 37;
            break;
          }
          step('Checking npm ownership ...');
          _context.next = 37;
          return checkOwnership(publishPkgNames, cwd);
        case 37:
          if (!dry) {
            _context.next = 44;
            break;
          }
          console.log();
          console.log(chalk.cyanBright.bold("Running in ".concat(publishPkgNames.length, " packages")));
          maxPadLength = publishPkgNames.slice().sort(function (a, b) {
            return b.length - a.length;
          })[0].length;
          console.log("".concat('PackageName'.padEnd(maxPadLength), " Path"));
          publishPkgNames.forEach(function (pkgName, index) {
            return console.log("".concat(pkgName.padEnd(maxPadLength), " ").concat(path.relative(cwd, publishPkgDirs[index])));
          });
          return _context.abrupt("return");
        case 44:
          bumpVersion = rootPkgJSON.version;
          changelog = '';
          if (publishOnly) {
            _context.next = 74;
            break;
          }
          // bump version
          step('Bump version ...');
          _context.next = 50;
          return getBumpVersion({
            cwd: cwd,
            pkgJSON: rootPkgJSON,
            publishPkgNames: publishPkgNames,
            tag: tag,
            targetVersion: version
          });
        case 50:
          bumpVersion = _context.sent;
          if (!confirm) {
            _context.next = 55;
            break;
          }
          _context.next = 54;
          return reconfirm({
            cwd: cwd,
            bumpVersion: bumpVersion,
            publishPkgNames: publishPkgNames,
            pkgJSON: rootPkgJSON,
            tag: tag,
            verbose: verbose
          });
        case 54:
          bumpVersion = _context.sent;
        case 55:
          if (!(typeof beforeUpdateVersion === 'function')) {
            _context.next = 58;
            break;
          }
          _context.next = 58;
          return beforeUpdateVersion(bumpVersion);
        case 58:
          // update all package versions and inter-dependencies
          step('Updating versions ...');
          _context.next = 61;
          return updateVersions({
            rootPkgJSONPath: rootPkgJSONPath,
            rootPkgJSON: rootPkgJSON,
            pkgNames: pkgNames,
            pkgJSONPaths: pkgJSONPaths,
            pkgJSONs: pkgJSONs,
            version: bumpVersion
          });
        case 61:
          // update pnpm-lock.yaml or package-lock.json
          step('Updating lockfile...');
          _context.next = 64;
          return updateLock(cwd);
        case 64:
          if (!(typeof beforeChangelog === 'function')) {
            _context.next = 67;
            break;
          }
          _context.next = 67;
          return beforeChangelog();
        case 67:
          // generate changelog
          step("Generating changelog ...");
          _context.next = 70;
          return generateChangelog({
            changelogPreset: changelogPreset,
            latest: latest,
            pkgName: rootPkgJSON.name,
            cwd: cwd
          });
        case 70:
          changelog = _context.sent;
          // commit git changes
          step('Committing changes ...');
          _context.next = 74;
          return commit(bumpVersion, gitPush);
        case 74:
          // publish package
          step("Publishing package ...");
          _context.next = 77;
          return publish({
            version: bumpVersion,
            publishPkgDirs: publishPkgDirs,
            publishPkgNames: publishPkgNames,
            cwd: cwd,
            tag: tag,
            gitCheck: gitCheck,
            changelog: changelog,
            repoType: repoType,
            repoUrl: repoUrl,
            githubRelease: githubRelease
          });
        case 77:
          if (!syncCnpm) {
            _context.next = 81;
            break;
          }
          step('Sync cnpm ...');
          _context.next = 81;
          return sync(publishPkgNames);
        case 81:
        case "end":
          return _context.stop();
      }
    }, _callee);
  }));
  return _release.apply(this, arguments);
}