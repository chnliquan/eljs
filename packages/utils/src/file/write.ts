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
  return JSON.stringify(content, null, 2) + EOL
}

/**
 * 写入文件内容
 * @param path - 文件路径
 * @param content - 文件内容
 * @param encoding - 文件编码
 */
export async function writeFile(
  path: string,
  content: string,
  encoding: BufferEncoding = 'utf8',
): Promise<void> {
  try {
    await fsp.writeFile(path, content, encoding)
  } catch (error) {
    const err = error as Error
    err.message = `Write ${path} failed: ${err.message}`
    throw err
  }
}

/**
 * 写入文件内容
 * @param path - 文件路径
 * @param content - 文件内容
 * @param encoding - 文件编码
 */
export function writeFileSync(
  path: string,
  content: string,
  encoding: BufferEncoding = 'utf8',
): void {
  try {
    fs.writeFileSync(path, content, encoding)
  } catch (error) {
    const err = error as Error
    err.message = `Write ${path} failed: ${err.message}`
    throw err
  }
}

/**
 * 原子写入文件
 * @param path - 文件路径
 * @param content - 文件内容
 * @param encoding - 文件编码
 * @returns 重命名临时文件完成后结束
 */
export async function writeFileAtomic(
  path: string,
  content: string,
  encoding: BufferEncoding = 'utf8',
): Promise<void> {
  const tmpFile = `${path}.${randomUUID()}-tmp`

  try {
    await writeFile(tmpFile, content, encoding)
    await fsp.rename(tmpFile, path)
  } catch (error) {
    await cleanupTemporaryFile(tmpFile, error)
    throw error
  }
}

/**
 * 同步原子写入文件
 * @param path - 文件路径
 * @param content - 文件内容
 * @param encoding - 文件编码
 */
export function writeFileAtomicSync(
  path: string,
  content: string,
  encoding: BufferEncoding = 'utf8',
): void {
  const tmpFile = `${path}.${randomUUID()}-tmp`

  try {
    writeFileSync(tmpFile, content, encoding)
    fs.renameSync(tmpFile, path)
  } catch (error) {
    cleanupTemporaryFileSync(tmpFile, error)
    throw error
  }
}

/**
 * 写入 Json 文件
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
 * @param path - 文件路径
 * @param data - 文件内容
 */
export function writeJsonAtomicSync<T extends object>(
  path: string,
  data: T,
): void {
  writeFileAtomicSync(path, serializeJson(data))
}
