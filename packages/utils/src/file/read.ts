import fs from 'node:fs'
import fsp from 'node:fs/promises'
import parseJson from 'parse-json'

/**
 * 读取文件内容
 * @param file 文件路径
 * @param encoding 文件编码
 */
export async function readFile(
  file: string,
  encoding: BufferEncoding = 'utf8',
): Promise<string> {
  try {
    const content = await fsp.readFile(file, encoding)
    return content
  } catch (error) {
    const err = error as Error
    err.message = `Read ${file} failed:\n${err.message}`
    throw err
  }
}

/**
 * 读取文件内容
 * @param file 文件路径
 * @param encoding 文件编码
 */
export function readFileSync(
  file: string,
  encoding: BufferEncoding = 'utf8',
): string {
  try {
    const content = fs.readFileSync(file, encoding)
    return content
  } catch (error) {
    const err = error as Error
    err.message = `Read ${file} failed:\n${err.message}`
    throw err
  }
}

/**
 * 读取 Json 文件
 * @param file 文件路径
 */
export async function readJson<T extends object>(file: string): Promise<T> {
  try {
    const content = await readFile(file)
    const json = parseJson(content)
    return json as T
  } catch (error) {
    const err = error as Error
    err.message = `Read ${file} failed:\n${err.message}`
    throw err
  }
}

/**
 * 读取 Json 文件
 * @param file 文件路径
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function readJsonSync<T extends object>(file: string): T {
  try {
    const content = readFileSync(file)
    const json = parseJson(content)
    return json as T
  } catch (error) {
    const err = error as Error
    err.message = `Read ${file} failed:\n${err.message}`
    throw err
  }
}
