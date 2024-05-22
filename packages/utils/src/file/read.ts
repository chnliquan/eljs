import fs from 'fs'
import parseJSON from 'parse-json'

/**
 * 读取 JSON 文件
 * @param file 文件路径
 */
export function readJSONSync<T extends Record<string, unknown>>(
  file: string,
): T {
  try {
    return parseJSON(fs.readFileSync(file, 'utf8'))
  } catch (err) {
    return Object.create(null)
  }
}
