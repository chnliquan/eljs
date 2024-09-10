/// <reference types="node" />
import fs from 'fs'
/**
 * 是否是文件
 * @param file 文件路径
 */
export declare function isFileSync(file: string): boolean
/**
 * 是否是文件
 * @param file 文件路径
 */
export declare function isFile(file: string): Promise<boolean>
/**
 * 是否是文件夹
 * @param dir 文件路径夹
 */
export declare function isDirectorySync(dir: string): boolean
/**
 * 是否是文件夹
 * @param dir 文件路径夹
 */
export declare function isDirectory(dir: string): Promise<boolean>
/**
 * 是否是符号链接
 * @param link 链接路径
 */
export declare function isSymlinkSync(link: string): boolean
/**
 * 是否是符号链接
 * @param link 链接路径
 */
export declare function isSymlink(link: string): Promise<boolean>
/**
 * 指定路径是否存在
 * @param file 文件路径
 */
export declare function isPathExistsSync(file: string): boolean
/**
 * 指定路径是否存在
 * @param file 文件路径
 */
export declare function isPathExists(file: string): Promise<boolean>
export declare function fstatSync(
  file: string,
  symlink?: boolean,
): fs.Stats | boolean
export declare function fstat(
  file: string,
  symlink?: boolean,
): Promise<fs.Stats | boolean>
//# sourceMappingURL=is.d.ts.map
