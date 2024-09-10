import { extractCallDir, isDirectorySync } from '@eljs/utils';
import { join, resolve } from 'path';
export default (function (api) {
  // 复制文件夹
  api.registerMethod({
    name: 'render',
    fn: function fn(path) {
      var data = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      var opts = arguments.length > 2 ? arguments[2] : undefined;
      var baseDir = extractCallDir(3);
      var srcFile = resolve(baseDir, path);
      if (isDirectorySync(srcFile)) {
        api.copyDirectory({
          from: srcFile,
          to: api.paths.target,
          data: data,
          opts: opts
        });
      } else {
        var destFile = join(api.paths.target, srcFile.replace(/\.tpl$/, ''));
        if (srcFile.endsWith('.tpl')) {
          api.copyTpl({
            from: srcFile,
            to: destFile,
            data: data,
            opts: opts
          });
        } else {
          api.copyFile({
            from: srcFile,
            to: destFile,
            data: data,
            opts: opts
          });
        }
      }
    }
  });
});