/// <reference types="node" />
/**
 * 读取文件内容
 * @param file 文件路径
 * @param encoding 文件编码
 */
export declare function readFileSync(
  file: string,
  encoding?: BufferEncoding,
): string
/**
 * 读取文件内容
 * @param file 文件路径
 * @param encoding 文件编码
 */
export declare function readFile(
  file: string,
  encoding?: BufferEncoding,
): Promise<string>
/**
 * 读取 JSON 文件
 * @param file 文件路径
 */
export declare function readJSONSync<T extends Record<string, any>>(
  file: string,
): T
/**
 * 读取 JSON 文件
 * @param file 文件路径
 */
export declare function readJSON<T extends Record<string, any>>(
  file: string,
): Promise<T>
//# sourceMappingURL=read.d.ts.map
