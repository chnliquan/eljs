import { readFile, readFileSync } from '../file/read'
import {
  loadParseJson,
  loadYaml as loadYamlDependency,
} from '../internal/lazy-dependencies'
import { contextualizeError } from './error'

let parseJson: typeof import('parse-json').default

/**
 * 加载 JSON 文件
 * @param path - 文件路径
 * @returns 解析后的数据
 * @throws JSON 解析失败时补充路径上下文；不可修改的错误或其他抛出值通过 `cause` 保留
 */
export async function loadJson<T>(path: string): Promise<T> {
  parseJson ||= loadParseJson()
  const content = await readFile(path)

  try {
    return parseJson(content) as T
  } catch (error) {
    throw contextualizeError(error, `Parse ${path} failed`)
  }
}

/**
 * 同步加载 JSON 文件
 * @param path - 文件路径
 * @returns 解析后的数据
 * @throws JSON 解析失败时补充路径上下文；不可修改的错误或其他抛出值通过 `cause` 保留
 */
export function loadJsonSync<T>(path: string): T {
  parseJson ||= loadParseJson()
  const content = readFileSync(path)

  try {
    return parseJson(content) as T
  } catch (error) {
    throw contextualizeError(error, `Parse ${path} failed`)
  }
}

let yaml: typeof import('js-yaml')

/**
 * 加载 YAML 文件
 * @param path - 文件路径
 * @returns 解析后的数据
 * @throws YAML 解析失败时补充路径上下文；不可修改的错误或其他抛出值通过 `cause` 保留
 */
export async function loadYaml<T>(path: string): Promise<T> {
  yaml ||= loadYamlDependency()
  const content = await readFile(path)

  try {
    return yaml.load(content) as T
  } catch (error) {
    throw contextualizeError(error, `Load ${path} failed`)
  }
}

/**
 * 同步加载 YAML 文件
 * @param path - 文件路径
 * @returns 解析后的数据
 * @throws YAML 解析失败时补充路径上下文；不可修改的错误或其他抛出值通过 `cause` 保留
 */
export function loadYamlSync<T>(path: string): T {
  yaml ||= loadYamlDependency()
  const content = readFileSync(path)

  try {
    return yaml.load(content) as T
  } catch (error) {
    throw contextualizeError(error, `Load ${path} failed`)
  }
}
