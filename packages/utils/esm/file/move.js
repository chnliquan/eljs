import fs from 'fs';
import { isPathExistsSync } from "./is";
import { removeSync } from "./remove";

/**
 * 移动文件
 * @param src 原路径
 * @param dest 目标路径
 * @param overwrite 是否覆盖
 */
export function moveSync(src, dest, overwrite) {
  if (overwrite) {
    removeSync(dest);
    fs.renameSync(src, dest);
    return;
  }
  if (isPathExistsSync(dest)) {
    throw Error("The dest ".concat(dest, " already exists."));
  } else {
    fs.renameSync(src, dest);
  }
}