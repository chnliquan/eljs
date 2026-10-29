import type { Abortable } from 'node:events'
import fs from 'node:fs'
import fsp from 'node:fs/promises'

import { loadParseJson } from '../internal/lazy-dependencies'

let parseJson: typeof import('parse-json').default

/**
 * 惰性加载并复用 JSON 解析器，避免纯文本读取提前初始化解析依赖
 * @returns JSON 解析函数
 * @internal
 */
function getParseJson(): typeof import('parse-json').default {
  parseJson ||= loadParseJson()
  return parseJson
}

/**
 * 异步读取选项，支持打开标志和取消信号
 * @remarks 编码省略或为 `undefined` 时使用 UTF-8，显式 `null` 返回 Buffer
 */
export type ReadFileOptions = fs.ObjectEncodingOptions &
  Abortable & { flag?: fs.OpenMode | undefined }

/**
 * 同步读取选项，支持打开标志
 * @remarks 编码省略或为 `undefined` 时使用 UTF-8，显式 `null` 返回 Buffer；不支持取消信号
 */
export type ReadFileSyncOptions = fs.ObjectEncodingOptions & {
  flag?: string | undefined
}

/**
 * 异步读取原始字节
 * @param file - 文件路径
 * @param options - `null` 或编码明确为 `null` 的选项
 * @returns 未经解码的 Buffer
 * @throws 保留原始读取错误及错误码，并在消息中补充文件路径
 */
export function readFile(
  file: string,
  options: null | (ReadFileOptions & { encoding: null }),
): Promise<Buffer>
/**
 * 异步读取文本，默认使用 UTF-8
 * @param file - 文件路径
 * @param options - 编码或读取选项，编码省略或为 `undefined` 时仍返回字符串
 * @returns 指定编码解码后的字符串
 * @remarks 不修改调用方选项；`signal` 可取消读取
 * @throws 保留原始读取错误及错误码，并在消息中补充文件路径
 */
export function readFile(
  file: string,
  options?:
    | BufferEncoding
    | (ReadFileOptions & { encoding?: BufferEncoding | undefined }),
): Promise<string>
/**
 * 使用动态编码或选项异步读取文件
 * @param file - 文件路径
 * @param options - 编码、读取选项或 `null`
 * @returns 仅显式 `null` 编码返回 Buffer，其余情况返回字符串
 * @remarks 不修改调用方选项；省略编码使用 UTF-8，`signal` 可取消读取
 * @throws 保留原始读取错误及错误码，并在消息中补充文件路径
 */
export function readFile(
  file: string,
  options?: BufferEncoding | ReadFileOptions | null,
): Promise<string | Buffer>
export async function readFile(
  file: string,
  options: BufferEncoding | ReadFileOptions | null = 'utf8',
): Promise<string | Buffer> {
  try {
    const normalized: BufferEncoding | ReadFileOptions | null =
      options !== null && typeof options === 'object'
        ? {
            ...options,
            encoding:
              options.encoding === undefined ? 'utf8' : options.encoding,
          }
        : options
    const content = await fsp.readFile(file, normalized)
    return content
  } catch (error) {
    const err = error as Error
    err.message = `Read ${file} failed: ${err.message}`
    throw err
  }
}

/**
 * 同步读取原始字节
 * @param file - 文件路径
 * @param options - `null` 或编码明确为 `null` 的选项
 * @returns 未经解码的 Buffer
 * @throws 保留原始读取错误及错误码，并在消息中补充文件路径
 */
export function readFileSync(
  file: string,
  options: null | (ReadFileSyncOptions & { encoding: null }),
): Buffer
/**
 * 同步读取文本，默认使用 UTF-8
 * @param file - 文件路径
 * @param options - 编码或读取选项，编码省略或为 `undefined` 时仍返回字符串
 * @returns 指定编码解码后的字符串
 * @remarks 不修改调用方选项
 * @throws 保留原始读取错误及错误码，并在消息中补充文件路径
 */
export function readFileSync(
  file: string,
  options?:
    | BufferEncoding
    | (ReadFileSyncOptions & { encoding?: BufferEncoding | undefined }),
): string
/**
 * 使用动态编码或选项同步读取文件
 * @param file - 文件路径
 * @param options - 编码、读取选项或 `null`
 * @returns 仅显式 `null` 编码返回 Buffer，其余情况返回字符串
 * @remarks 不修改调用方选项；省略编码使用 UTF-8
 * @throws 保留原始读取错误及错误码，并在消息中补充文件路径
 */
export function readFileSync(
  file: string,
  options?: BufferEncoding | ReadFileSyncOptions | null,
): string | Buffer
export function readFileSync(
  file: string,
  options: BufferEncoding | ReadFileSyncOptions | null = 'utf8',
): string | Buffer {
  try {
    const normalized: BufferEncoding | ReadFileSyncOptions | null =
      options !== null && typeof options === 'object'
        ? {
            ...options,
            encoding:
              options.encoding === undefined ? 'utf8' : options.encoding,
          }
        : options
    const content = fs.readFileSync(file, normalized)
    return content
  } catch (error) {
    const err = error as Error
    err.message = `Read ${file} failed: ${err.message}`
    throw err
  }
}

/**
 * 读取 Json 文件
 * @param file - 文件路径
 */
export async function readJson<T extends object>(file: string): Promise<T> {
  const content = await readFile(file)

  try {
    const json = getParseJson()(content)
    return json as T
  } catch (error) {
    const err = error as Error
    err.message = `Parse ${file} failed: ${err.message}`
    throw err
  }
}

/**
 * 读取 Json 文件
 * @param file - 文件路径
 */

export function readJsonSync<T extends object>(file: string): T {
  const content = readFileSync(file)

  try {
    const json = getParseJson()(content)
    return json as T
  } catch (error) {
    const err = error as Error
    err.message = `Parse ${file} failed: ${err.message}`
    throw err
  }
}
