function _createForOfIteratorHelper(o, allowArrayLike) { var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"]; if (!it) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = it.call(o); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
import path from 'path';
import { isPathExistsSync } from "../file";

/**
 * 获取存在的路径
 * @param paths 路径数组
 */
export function tryPaths(paths) {
  var _iterator = _createForOfIteratorHelper(paths),
    _step;
  try {
    for (_iterator.s(); !(_step = _iterator.n()).done;) {
      var _path = _step.value;
      if (isPathExistsSync(_path)) {
        return _path;
      }
    }
  } catch (err) {
    _iterator.e(err);
  } finally {
    _iterator.f();
  }
}

/**
 * 提取代码执行时的文件夹
 * @param stack 栈深度
 */
export function extractCallDir() {
  var stack = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 2;
  var obj = Object.create(null);
  Error.captureStackTrace(obj);
  var callSite = obj.stack.split('\n')[stack];

  // the regexp for the stack when called inside a named function
  var namedStackRegExp = /\s\((.*):\d+:\d+\)$/;
  // the regexp for the stack when called inside an anonymous
  var anonymousStackRegExp = /at (.*):\d+:\d+$/;
  var matchResult = callSite.match(namedStackRegExp);
  if (!matchResult) {
    matchResult = callSite.match(anonymousStackRegExp);
  }
  var fileName = matchResult[1];
  return path.dirname(fileName);
}