import execa from 'execa';
var cache = new Map();

/**
 * 命令是否全局安装
 * @param bin 全局命令
 */
export function hasGlobalInstallation(bin) {
  var cacheKey = "has_global_".concat(bin);
  if (cache.has(cacheKey)) {
    return Promise.resolve(cache.get(cacheKey));
  }
  return execa(bin, ['--version']).then(function (data) {
    return /^\d+.\d+.\d+$/.test(data.stdout);
  }).then(function (value) {
    cache.set(cacheKey, value);
    return value;
  }).catch(function () {
    return false;
  });
}