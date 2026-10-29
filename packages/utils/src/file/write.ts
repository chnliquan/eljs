import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { EOL } from 'node:os'

/**
 * 删除原子写入遗留的临时文件，同时保留写入失败和清理失败
 *
 * @param tmpFile - 临时文件路径
 * @param writeError - 原始写入错误
 */
async function cleanupTemporaryFile(
  tmpFile: string,
  writeError: unknown,
): Promise<void> {
  try {
    await fsp.unlink(tmpFile)
  } catch (cleanupError) {
    if ((cleanupError as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw new AggregateError(
        [writeError, cleanupError],
        'Atomic write failed and temporary file cleanup also failed',
        { cause: cleanupError },
      )
    }
  }
}

/**
 * 同步删除原子写入遗留的临时文件，同时保留写入失败和清理失败
 *
 * @param tmpFile - 临时文件路径
 * @param writeError - 原始写入错误
 */
function cleanupTemporaryFileSync(tmpFile: string, writeError: unknown): void {
  try {
    fs.unlinkSync(tmpFile)
  } catch (cleanupError) {
    if ((cleanupError as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw new AggregateError(
        [writeError, cleanupError],
        'Atomic write failed and temporary file cleanup also failed',
        { cause: cleanupError },
      )
    }
  }
}

function serializeJson(content: object): string {
  const serialized = JSON.stringify(content, null, 2)
  if (serialized === undefined) {
    throw new TypeError('JSON serialization must produce a value')
  }
  return serialized + EOL
}

/**
 * 同步文件写入选项，可使用编码字符串、null 或选项对象
 * @remarks 支持编码、权限、写入标志和 flush；不支持取消信号
 */
export type WriteFileSyncOptions =
  | BufferEncoding
  | null
  | (Omit<Exclude<fs.WriteFileOptions, BufferEncoding | null>, 'signal'> & {
      /** 同步写入不支持取消信号 */
      signal?: never
    })

/**
 * 异步原子写入选项
 * @remarks 支持编码、临时文件权限、flush 和取消信号；重命名会替换目标，不支持写入标志
 */
export type WriteFileAtomicOptions = Omit<
  Exclude<fs.WriteFileOptions, BufferEncoding | null>,
  'flag'
> & {
  /** 写入标志不适用于重命名替换目标的原子写入 */
  flag?: never
}

/**
 * 同步原子写入选项
 * @remarks 支持编码、临时文件权限和 flush，不支持写入标志或取消信号
 */
export type WriteFileAtomicSyncOptions = Omit<
  WriteFileAtomicOptions,
  'signal'
> & {
  /** 同步写入不支持取消信号 */
  signal?: never
}

/**
 * 在创建临时文件前拒绝无法作用于原子替换的选项，包括 JavaScript 调用方传入的值
 */
function validateAtomicWriteOptions(
  options: BufferEncoding | WriteFileAtomicOptions,
  synchronous = false,
): void {
  if (typeof options === 'object' && options !== null) {
    if (options.flag !== undefined) {
      throw new TypeError('Atomic writes do not support the flag option')
    }
    if (synchronous && options.signal !== undefined) {
      throw new TypeError('Synchronous atomic writes do not support signal')
    }
  }
}

/**
 * 写入文件内容
 * @remarks 默认使用 UTF-8 编码，默认覆盖已有文件；传入 `flag: 'wx'` 可仅创建新文件
 * @param path - 文件路径
 * @param content - 文件内容
 * @param options - 文件编码或 Node.js 写入选项，省略编码时使用 UTF-8
 * @throws 写入失败时保留原始错误及错误码，并在消息中补充文件路径
 */
export async function writeFile(
  path: string,
  content: string,
  options: fs.WriteFileOptions = 'utf8',
): Promise<void> {
  try {
    await fsp.writeFile(path, content, options)
  } catch (error) {
    const err = error as Error
    err.message = `Write ${path} failed: ${err.message}`
    throw err
  }
}

/**
 * 同步写入文件内容
 * @remarks 默认使用 UTF-8 编码，默认覆盖已有文件；传入 `flag: 'wx'` 可仅创建新文件，修改前拒绝取消信号
 * @param path - 文件路径
 * @param content - 文件内容
 * @param options - 文件编码或 Node.js 写入选项，省略编码时使用 UTF-8
 * @throws 写入失败时保留原始错误及错误码，并在消息中补充文件路径
 */
export function writeFileSync(
  path: string,
  content: string,
  options: WriteFileSyncOptions = 'utf8',
): void {
  try {
    if (
      typeof options === 'object' &&
      options !== null &&
      options.signal !== undefined
    ) {
      throw new TypeError('Synchronous writes do not support signal')
    }
    fs.writeFileSync(path, content, options)
  } catch (error) {
    const err = error as Error
    err.message = `Write ${path} failed: ${err.message}`
    throw err
  }
}

/**
 * 原子写入文件
 * @remarks 使用临时文件后重命名替换目标；`mode` 控制替换后文件权限，`flush` 仅刷新临时文件
 * @param path - 文件路径
 * @param content - 文件内容
 * @param options - 文件编码或原子写入选项，默认使用 UTF-8
 * @returns 重命名临时文件完成后结束
 * @throws 选项无效、写入、取消或重命名失败时抛出错误，并清理已创建的临时文件
 */
export async function writeFileAtomic(
  path: string,
  content: string,
  options: BufferEncoding | WriteFileAtomicOptions = 'utf8',
): Promise<void> {
  validateAtomicWriteOptions(options)
  const tmpFile = `${path}.${randomUUID()}-tmp`
  const signal =
    typeof options === 'object' && options !== null ? options.signal : undefined

  try {
    await writeFile(tmpFile, content, options)
    // 写入完成后再次检查取消，避免已取消的任务仍开始替换目标。
    // 重命名一旦开始，取消信号不会回滚替换。
    signal?.throwIfAborted()
    await fsp.rename(tmpFile, path)
  } catch (error) {
    await cleanupTemporaryFile(tmpFile, error)
    throw error
  }
}

/**
 * 同步原子写入文件
 * @remarks 使用临时文件后重命名替换目标；`mode` 控制替换后文件权限，`flush` 仅刷新临时文件
 * @param path - 文件路径
 * @param content - 文件内容
 * @param options - 文件编码或同步原子写入选项，默认使用 UTF-8
 * @throws 选项无效、写入或重命名失败时抛出错误，并清理已创建的临时文件
 */
export function writeFileAtomicSync(
  path: string,
  content: string,
  options: BufferEncoding | WriteFileAtomicSyncOptions = 'utf8',
): void {
  validateAtomicWriteOptions(options, true)
  const tmpFile = `${path}.${randomUUID()}-tmp`

  try {
    writeFileSync(tmpFile, content, options)
    fs.renameSync(tmpFile, path)
  } catch (error) {
    cleanupTemporaryFileSync(tmpFile, error)
    throw error
  }
}

/**
 * 写入 Json 文件
 * @throws 序列化失败或未产生 JSON 值时在修改目标前抛出错误
 * @param path - 文件路径
 * @param content - 文件内容
 */
export async function writeJson<T extends object>(
  path: string,
  content: T,
): Promise<void> {
  return writeFile(path, serializeJson(content))
}

/**
 * 写入 Json 文件
 * @throws 序列化失败或未产生 JSON 值时在修改目标前抛出错误
 * @param path - 文件路径
 * @param content - 文件内容
 */
export function writeJsonSync<T extends object>(
  path: string,
  content: T,
): void {
  writeFileSync(path, serializeJson(content))
}

/**
 * 原子写入 JSON 文件
 * @throws 序列化失败或未产生 JSON 值时在创建临时文件前抛出错误
 * @param path - 文件路径
 * @param data - 文件内容
 * @returns 重命名临时文件完成后结束
 */
export async function writeJsonAtomic<T extends object>(
  path: string,
  data: T,
): Promise<void> {
  return writeFileAtomic(path, serializeJson(data))
}

/**
 * 同步原子写入 JSON 文件
 * @throws 序列化失败或未产生 JSON 值时在创建临时文件前抛出错误
 * @param path - 文件路径
 * @param data - 文件内容
 */
export function writeJsonAtomicSync<T extends object>(
  path: string,
  data: T,
): void {
  writeFileAtomicSync(path, serializeJson(data))
}
