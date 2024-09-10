import rimraf from 'rimraf';

/**
 * 删除文件
 * @param file 文件路径
 */
export function removeSync(file) {
  rimraf.sync(file);
}