/// <reference types="node" />
import type { PkgJSON } from '../types'
/**
 * 写入 JSON 文件
 * @param file 文件路径
 * @param content 文件内容
 */
export declare function writeJSONSync<T extends Record<string, any>>(
  file: string,
  content: T,
): void
/**
 * 写入 JSON 文件
 * @param file 文件路径
 * @param content 文件内容
 */
export declare function writeJSON<T extends Record<string, any>>(
  file: string,
  content: T,
): Promise<void>
/**
 * 更新指定文件夹下的 package.json 文件
 * @param json 文件内容
 * @param dir 文件夹路径
 */
export declare function updatePkgJSONSync(
  json: Partial<PkgJSON>,
  dir?: string,
): void
/**
 * 更新指定文件夹下的 package.json 文件
 * @param json 文件内容
 * @param dir 文件夹路径
 */
export declare function updatePkgJSON(
  json: Partial<PkgJSON>,
  dir?: string,
): Promise<void>
/**
 * 安全写入 JSON 文件
 * @param file 文件路径
 * @param json 文件内容
 */
export declare function safeWriteJSONSync<T extends Record<string, any>>(
  file: string,
  json: T,
): void
/**
 * 安全写入 JSON 文件
 * @param file 文件路径
 * @param json 文件内容
 */
export declare function safeWriteJSON<T extends Record<string, any>>(
  file: string,
  json: T,
): Promise<void>
/**
 * 写入文件内容
 * @param file 文件路径
 * @param content 文件内容
 * @param encoding 文件编码
 */
export declare function writeFileSync(
  file: string,
  content: string,
  encoding?: BufferEncoding,
): void
/**
 * 写入文件内容
 * @param file 文件路径
 * @param content 文件内容
 * @param encoding 文件编码
 */
export declare function writeFile(
  file: string,
  content: string,
  encoding?: BufferEncoding,
): Promise<void>
/**
 * 安全写入文件
 * @param file 文件路径
 * @param content 文件内容
 * @param encoding 文件编码
 */
export declare function safeWriteFileSync(
  file: string,
  content: string,
  encoding?: BufferEncoding,
): void
/**
 * 安全写入文件
 * @param file 文件路径
 * @param content 文件内容
 * @param encoding 文件编码
 */
export declare function safeWriteFile(
  file: string,
  content: string,
  encoding?: BufferEncoding,
): Promise<void>
//# sourceMappingURL=write.d.ts.map
