function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _toArray(arr) { return _arrayWithHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }
function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }
function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }
function _createForOfIteratorHelper(o, allowArrayLike) { var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"]; if (!it) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = it.call(o); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
import chalk from 'chalk';
import cp from 'child_process';
import execa from 'execa';
import path from 'path';
import read from 'read';
import { isPathExistsSync } from "../file";
var SPACES_REGEXP = / +/g;
export function parseCommand(command) {
  var tokens = [];
  var _iterator = _createForOfIteratorHelper(command.trim().split(SPACES_REGEXP)),
    _step;
  try {
    for (_iterator.s(); !(_step = _iterator.n()).done;) {
      var token = _step.value;
      // Allow spaces to be escaped by a backslash if not meant as a delimiter
      var previousToken = tokens[tokens.length - 1];
      if (previousToken && previousToken.endsWith('\\')) {
        // Merge previous token with current one
        tokens[tokens.length - 1] = "".concat(previousToken.slice(0, -1), " ").concat(token);
      } else {
        tokens.push(token);
      }
    }
  } catch (err) {
    _iterator.e(err);
  } finally {
    _iterator.f();
  }
  return tokens;
}

/**
 * 执行命令
 * @param cmd 可执行命令
 * @param args 命令可传入的参数
 * @param opts 选项
 */
export function run(cmd, args, opts) {
  if ((opts === null || opts === void 0 ? void 0 : opts.verbose) !== false) {
    var _console;
    (_console = console).log.apply(_console, ['$', chalk.greenBright(cmd)].concat(_toConsumableArray(args)));
  }
  return execa(cmd, args, opts);
}

/**
 * 执行命令
 * @param command 命令字符串
 * @param opts 选项
 */
export function runCommand(command, opts) {
  var _parseCommand = parseCommand(command),
    _parseCommand2 = _toArray(_parseCommand),
    cmd = _parseCommand2[0],
    args = _parseCommand2.slice(1);
  return run(cmd, args, opts);
}
export function getPid(cmd) {
  var parse = function parse(data, cmd) {
    var reg = new RegExp('/' + cmd + '$');
    var lines = data.trim().split('\n');
    var _iterator2 = _createForOfIteratorHelper(lines),
      _step2;
    try {
      for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
        var line = _step2.value;
        var fields = line.trim().split(/\s+/, 2);
        if (fields.length !== 2) {
          continue;
        }
        var _fields = _slicedToArray(fields, 2),
          pid = _fields[0],
          cmdName = _fields[1];
        if (cmdName === cmd || reg.test(cmdName)) {
          return parseInt(pid, 10);
        }
      }
    } catch (err) {
      _iterator2.e(err);
    } finally {
      _iterator2.f();
    }
    return null;
  };
  return new Promise(function (resolve, reject) {
    runCommand('ps -eo pid,comm').then(function (value) {
      var pid = parse(value.stdout, cmd);
      resolve(pid);
    }).catch(reject);
  });
}
var cachedPassword;
export function sudo(args, opts) {
  var NEED_PASSWORD = '#node-sudo-passwd#';
  var _ref = opts || {},
    _ref$spawnOpts = _ref.spawnOpts,
    spawnOpts = _ref$spawnOpts === void 0 ? {} : _ref$spawnOpts,
    password = _ref.password,
    cachePassword = _ref.cachePassword,
    _ref$prompt = _ref.prompt,
    prompt = _ref$prompt === void 0 ? 'sudo requires your password' : _ref$prompt;
  var bin = getExecutableCmd('sudo');
  args = ['-S', '-p', NEED_PASSWORD].concat(args);
  spawnOpts.stdio = 'pipe';
  var child = cp.spawn(bin, args, spawnOpts);
  if (child.stdout) {
    child.stdout.on('data', function (chunk) {
      console.log(chunk.toString().trim());
    });
  }
  if (child.stderr) {
    child.stderr.on('data', function (chunk) {
      var lines = chunk.toString().trim().split('\n');
      lines.forEach(function (line) {
        if (line === NEED_PASSWORD) {
          if (password) {
            var _child$stdin;
            (_child$stdin = child.stdin) === null || _child$stdin === void 0 || _child$stdin.write(password + '\n');
          } else if (cachePassword && cachedPassword) {
            var _child$stdin2;
            (_child$stdin2 = child.stdin) === null || _child$stdin2 === void 0 || _child$stdin2.write(cachedPassword + '\n');
          } else {
            read({
              prompt: prompt,
              silent: true
            }, function (err, answer) {
              var _child$stdin3;
              (_child$stdin3 = child.stdin) === null || _child$stdin3 === void 0 || _child$stdin3.write(answer + '\n');
              if (cachePassword) {
                cachedPassword = answer;
              }
            });
          }
        } else {
          console.log(line);
        }
      });
    });
  }
}
export function getExecutableCmd(target, dirs) {
  if (!dirs) {
    dirs = (process.env.PATH || '').split(':');
  }
  var _iterator3 = _createForOfIteratorHelper(dirs),
    _step3;
  try {
    for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
      var dir = _step3.value;
      var p = path.join(dir, target);
      if (isPathExistsSync(p)) {
        return p;
      }
    }
  } catch (err) {
    _iterator3.e(err);
  } finally {
    _iterator3.f();
  }
  return null;
}