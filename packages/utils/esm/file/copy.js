function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : String(i); }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
import chalk from 'chalk';
import fs from 'fs';
import glob from 'glob';
import path from 'path';
import { mkdirSync } from "./dir";
import { isDirectorySync } from "./is";
import { renderTemplate } from "./render";

/**
 * 文件拷贝选项
 */

/**
 * 拷贝文件
 * @param opts 文件拷贝选项
 */
export function copyFile(opts) {
  var destFile = convertFilePrefix(opts.to);
  if (destFile.indexOf('{{') > -1 || destFile.indexOf('<%') > -1) {
    destFile = renderTemplate(destFile, opts.data || {}, opts.opts);
  }
  mkdirSync(path.dirname(destFile));
  if (opts.basedir) {
    console.log("".concat(chalk.green('Copy: '), " ").concat(path.relative(opts.basedir, destFile)));
  }
  fs.copyFileSync(opts.from, destFile);
}

/**
 * 模版拷贝选项
 */

/**
 * 拷贝模版
 * @param opts 模版拷贝选项
 */
export function copyTpl(opts) {
  var tpl = fs.readFileSync(opts.from, 'utf-8');
  var content = renderTemplate(tpl, opts.data, opts.opts);
  var destFile = convertFilePrefix(opts.to.replace(/\.tpl$/, ''));
  if (destFile.indexOf('{{') > -1 || destFile.indexOf('<%') > -1) {
    destFile = renderTemplate(destFile, opts.data, opts.opts);
  }
  mkdirSync(path.dirname(destFile));
  if (opts.basedir) {
    console.log("".concat(chalk.green('Write:'), " ").concat(path.relative(opts.basedir, destFile)));
  }
  fs.writeFileSync(destFile, content, 'utf-8');
}

/**
 * 文件夹拷贝选项
 */

/**
 * 拷贝文件夹
 * @param opts 文件夹拷贝选项
 */
export function copyDirectory(opts) {
  var files = glob.sync('**/*', {
    cwd: opts.from,
    dot: true,
    ignore: ['**/node_modules/**']
  });
  files.forEach(function (file) {
    var srcFile = path.join(opts.from, file);
    if (isDirectorySync(srcFile)) {
      return;
    }
    var destFile = path.join(opts.to, file);
    if (file.endsWith('.tpl')) {
      copyTpl(_objectSpread(_objectSpread({}, opts), {}, {
        from: srcFile,
        to: destFile
      }));
    } else {
      copyFile(_objectSpread(_objectSpread({}, opts), {}, {
        from: srcFile,
        to: destFile
      }));
    }
  });
}
function convertFilePrefix(file) {
  var prefix = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '-';
  if (file.indexOf(prefix) === -1) {
    return file;
  }
  return file.split('/').map(function (filename) {
    // dotfiles are ignored when published to npm, therefore in templates
    // we need to use underscore instead (e.g. "_gitignore")
    if (filename.charAt(0) === prefix && filename.charAt(1) !== prefix) {
      return ".".concat(filename.slice(1));
    }
    if (filename.charAt(0) === prefix && filename.charAt(1) === prefix) {
      return "".concat(filename.slice(1));
    }
    return filename;
  }).join('/');
}