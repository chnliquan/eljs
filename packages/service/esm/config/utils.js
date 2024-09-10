import { isAbsolute, join } from 'path';
export function addExt(opts) {
  var index = opts.file.lastIndexOf('.');
  return "".concat(opts.file.slice(0, index)).concat(opts.ext).concat(opts.file.slice(index));
}
export function getAbsFiles(opts) {
  return opts.files.map(function (file) {
    return isAbsolute(file) ? file : join(opts.cwd, file);
  });
}