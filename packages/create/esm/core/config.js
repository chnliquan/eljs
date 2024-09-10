import { isPathExistsSync, logger, resolve } from '@eljs/utils';
import { join } from 'path';
function getGenConfig(configFile) {
  try {
    return require(configFile);
  } catch (error) {
    return {};
  }
}
export function isGenConfigExist(cwd) {
  return isPathExistsSync(join(cwd, 'gen.json'));
}
export function getPresetsAndPlugins(cwd) {
  var config = getGenConfig(join(cwd, 'gen.json'));
  function get(type) {
    var value = config[type];
    if (Array.isArray(value)) {
      return value.map(function (item) {
        try {
          if (item.startsWith('./')) {
            return join(cwd, item);
          }
          return resolve.sync(item, {
            basedir: cwd,
            extensions: ['.tsx', '.ts', '.mjs', '.jsx', '.js']
          });
        } catch (err) {
          logger.error(err.message);
        }
      }).filter(Boolean);
    }
    return [];
  }
  return {
    presets: get('presets'),
    plugins: get('plugins')
  };
}