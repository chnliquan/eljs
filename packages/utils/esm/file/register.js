import { extname } from 'path';
import { addHook } from 'pirates';
var HOOK_EXTS = ['.ts', '.tsx'];
var registered = false;
var files = [];
// eslint-disable-next-line @typescript-eslint/no-empty-function
var revert = function revert() {};

/**
 * 文件转换实现器
 */

/**
 * 文件加载器选项
 */

/**
 * 注册文件加载器
 * @param opts 注册选项
 */
export function register(opts) {
  var implementor = opts.implementor,
    _opts$ignoreNodeModul = opts.ignoreNodeModules,
    ignoreNodeModules = _opts$ignoreNodeModul === void 0 ? true : _opts$ignoreNodeModul,
    _opts$exts = opts.exts,
    exts = _opts$exts === void 0 ? HOOK_EXTS : _opts$exts;
  files = [];
  if (!registered) {
    revert = addHook(function (code, filename) {
      return transform(code, filename, implementor);
    }, {
      exts: exts,
      ignoreNodeModules: ignoreNodeModules
    });
    registered = true;
  }
}

/**
 * 获取转换过的文件
 */
export function getFiles() {
  return files;
}

/**
 * 清空转换过的文件
 */
export function clearFiles() {
  files = [];
}

/**
 * 重置文件加载器
 */
export function restore() {
  revert();
  registered = false;
}
function transform(code, filename, implementor) {
  var ext = extname(filename);
  files.push(filename);
  try {
    return implementor.transformSync(code, {
      sourcefile: filename,
      loader: ext.slice(1),
      target: 'es2019',
      format: 'cjs',
      logLevel: 'error'
    }).code;
  } catch (e) {
    throw new Error("Transform file failed: [".concat(filename, "]."));
  }
}