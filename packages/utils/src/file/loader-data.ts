import {
  loadParseJson,
  loadYaml as loadYamlDependency,
} from './loader-dependencies'
import { readFile, readFileSync } from './read'

let parseJson: typeof import('parse-json').default

/**
 * 加载 JSON 文件
 * @param path - 文件路径
 * @returns 解析后的数据
 * @throws JSON 解析失败时抛出带路径上下文的错误
 */
export async function loadJson<T>(path: string): Promise<T> {
  parseJson ||= loadParseJson()
  const content = await readFile(path)

  try {
    return parseJson(content) as T
  } catch (error) {
    const err = error as Error
    err.message = `Parse ${path} failed: ${err.message}`
    throw err
  }
}

/**
 * 同步加载 JSON 文件
 * @param path - 文件路径
 * @returns 解析后的数据
 * @throws JSON 解析失败时抛出带路径上下文的错误
 */
export function loadJsonSync<T>(path: string): T {
  parseJson ||= loadParseJson()
  const content = readFileSync(path)

  try {
    return parseJson(content) as T
  } catch (error) {
    const err = error as Error
    err.message = `Parse ${path} failed: ${err.message}`
    throw err
  }
}

let yaml: typeof import('js-yaml')

/**
 * 加载 YAML 文件
 * @param path - 文件路径
 * @returns 解析后的数据
 * @throws YAML 解析失败时抛出带路径上下文的错误
 */
export async function loadYaml<T>(path: string): Promise<T> {
  yaml ||= loadYamlDependency()
  const content = await readFile(path)

  try {
    return yaml.load(content) as T
  } catch (error) {
    const err = error as Error
    err.message = `Load ${path} failed: ${err.message}`
    throw err
  }
}

/**
 * 同步加载 YAML 文件
 * @param path - 文件路径
 * @returns 解析后的数据
 * @throws YAML 解析失败时抛出带路径上下文的错误
 */
export function loadYamlSync<T>(path: string): T {
  yaml ||= loadYamlDependency()
  const content = readFileSync(path)

  try {
    return yaml.load(content) as T
  } catch (error) {
    const err = error as Error
    err.message = `Load ${path} failed: ${err.message}`
    throw err
  }
}
