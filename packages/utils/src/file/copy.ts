import chalk from 'chalk'
import ejs from 'ejs'
import { glob, globSync } from 'glob'
import Mustache from 'mustache'
import fs, { type WriteFileOptions } from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'

import { mkdir, mkdirSync } from './dir'
import { isDirectory, isDirectorySync } from './is'
import { readFile, readFileSync } from './read'
import { renderTemplate, type RenderTemplateOptions } from './render'
import { writeFile, writeFileSync, type WriteFileSyncOptions } from './write'
import {
  resolveWriteDestination,
  resolveWriteDestinationSync,
} from './write-boundary'

/**
 * 复制文件和模板时使用的选项
 */
export interface CopyFileOptions {
  /**
   * 普通文件的复制标志位，如 `fs.constants.COPYFILE_EXCL`
   * @remarks 传给 Node.js `copyFile`，不表示文件权限，也不作用于模板写入
   */
  mode?: number

  /** 文件基础路径，传入时打印相对路径日志 */
  basedir?: string

  /**
   * 将渲染后的文件目标限制在此输出根目录中
   * @remarks 根目录必须存在，子路径中的符号链接与路径越界会在创建目录或写入前被拒绝
   */
  destinationRoot?: string

  /** 模板渲染数据 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: Record<string, any>

  /** 渲染引擎选项 */
  renderOptions?: RenderTemplateOptions

  /**
   * 渲染后的模板文件写入选项
   * @remarks 仅作用于模板写入；可通过 `flag: 'wx'` 禁止覆盖，通过 `mode` 设置新文件权限
   */
  writeOptions?: WriteFileOptions
}

/**
 * 同步复制文件、模板或目录的选项
 * @remarks 模板写入使用同步写入选项，不支持取消信号
 */
export interface CopyFileSyncOptions extends Omit<
  CopyFileOptions,
  'writeOptions'
> {
  /** 渲染后的模板文件同步写入选项，不作用于普通文件复制 */
  writeOptions?: WriteFileSyncOptions
}

/**
 * 在同步复制产生文件系统副作用前拒绝 JavaScript 调用方传入的取消信号
 */
function validateCopyFileSyncOptions(options?: CopyFileSyncOptions): void {
  const writeOptions = options?.writeOptions
  if (
    typeof writeOptions === 'object' &&
    writeOptions !== null &&
    writeOptions.signal !== undefined
  ) {
    throw new TypeError('Synchronous copies do not support signal')
  }
}

/**
 * 将模板路径中的前导短横线转换为点文件前缀
 * @param file - 目标文件路径
 * @param prefix - 模板使用的转义前缀
 * @returns 转换后的目标文件路径
 */
function normalizeDotfilePath(file: string, prefix = '-'): string {
  if (!file.includes(prefix)) {
    return file
  }

  return file.replace(
    /(^|[\\/])(-{1,2})(?=[^\\/])/g,
    (_match, separator: string, matchedPrefix: string) =>
      separator + (matchedPrefix === prefix + prefix ? prefix : '.'),
  )
}

/**
 * 仅在路径包含当前渲染引擎的起始定界符时渲染，避免渲染选项改写普通文件名
 * @remarks 使用与内容渲染一致的自定义定界符及引擎默认值
 */
function renderCopyPath(
  file: string,
  data: Record<string, unknown>,
  options?: RenderTemplateOptions,
): string {
  let opening: string
  if (options?.type === 'ejs') {
    opening =
      (options.options?.openDelimiter || ejs.openDelimiter || '<') +
      (options.options?.delimiter || ejs.delimiter || '%')
  } else {
    const tags =
      options && 'tagsOrOptions' in options ? options.tagsOrOptions : undefined
    opening = (Array.isArray(tags) ? tags : tags?.tags)?.[0] ?? Mustache.tags[0]
  }
  return file.includes(opening) ? renderTemplate(file, data, options) : file
}

/**
 * 复制文件
 * @remarks 路径渲染遵循所选引擎的定界符，不含定界符的普通文件名保持原样
 * @param from - 源文件路径
 * @param to - 目标文件路径
 * @param options - 复制选项
 * @returns 复制完成后结束
 * @throws 目标越界、含符号链接、目录创建、路径渲染或文件复制失败时抛出带路径上下文的错误
 */
export async function copyFile(
  from: string,
  to: string,
  options: CopyFileOptions = {},
): Promise<void> {
  try {
    const { mode, basedir, data, renderOptions } = options
    let destination = renderCopyPath(
      normalizeDotfilePath(to),
      data || {},
      renderOptions,
    )
    if (options.destinationRoot !== undefined) {
      destination = await resolveWriteDestination(
        destination,
        options.destinationRoot,
      )
    }

    await mkdir(path.dirname(destination))

    if (basedir) {
      console.log(
        `${chalk.green('Copy: ')} ${path.relative(basedir, destination)}`,
      )
    }

    await fsp.copyFile(from, destination, mode)
  } catch (error) {
    const err = error as Error
    err.message = `Copy file from ${from} to ${to} failed: ${err.message}`
    throw err
  }
}

/**
 * 复制并渲染模板
 * @remarks 路径渲染遵循所选引擎的定界符，不含定界符的普通文件名保持原样
 * @param from - 源文件路径
 * @param to - 目标文件路径
 * @param data - 模板数据
 * @param options - 复制选项
 * @returns 写入完成后结束
 * @throws 目标边界校验、模板读取、渲染或写入失败时抛出带路径上下文的错误
 */
export async function copyTemplate(
  from: string,
  to: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
  options?: CopyFileOptions,
): Promise<void> {
  const { basedir, renderOptions, writeOptions } = options || {}

  try {
    const template = await readFile(from)
    const content = renderTemplate(template, data, renderOptions)
    let destination = renderCopyPath(
      normalizeDotfilePath(to.replace(/\.tpl$/, '')),
      data,
      renderOptions,
    )
    if (options?.destinationRoot !== undefined) {
      destination = await resolveWriteDestination(
        destination,
        options.destinationRoot,
      )
    }

    await mkdir(path.dirname(destination))

    if (basedir) {
      console.log(
        `${chalk.green('Write:')} ${path.relative(basedir, destination)}`,
      )
    }

    await writeFile(destination, content, writeOptions)
  } catch (error) {
    const err = error as Error
    err.message = `Copy template from ${from} to ${to} failed: ${err.message}`
    throw err
  }
}

/**
 * 复制目录内容并渲染其中的 `.tpl` 模板
 * @remarks 枚举前检查源目录；不存在时保留 ENOENT，非目录时抛出 ENOTDIR
 * @param from - 源目录路径
 * @param to - 目标目录路径
 * @param data - 模板数据
 * @param options - 复制选项
 * @returns 目录复制完成后结束
 * @throws 文件枚举、复制或模板渲染失败时抛出带目录上下文的错误
 */
export async function copyDirectory(
  from: string,
  to: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
  options: CopyFileOptions = {},
): Promise<void> {
  try {
    if (!(await fsp.stat(from)).isDirectory()) {
      throw Object.assign(new Error(`Not a directory: ${from}`), {
        code: 'ENOTDIR',
      })
    }
    const files = await glob('**/*', {
      cwd: await fsp.realpath(from),
      dot: true,
      ignore: ['**/node_modules/**'],
    })

    for (const file of files) {
      const source = path.join(from, file)

      if (await isDirectory(source)) {
        continue
      }

      const destination = path.join(to, file)

      if (file.endsWith('.tpl')) {
        await copyTemplate(source, destination, data, options)
      } else {
        await copyFile(source, destination, { ...options, data })
      }
    }
  } catch (error) {
    const err = error as Error
    err.message = `Copy directory from ${from} to ${to} failed: ${err.message}`
    throw err
  }
}

/**
 * 同步复制文件
 * @remarks 路径渲染遵循所选引擎的定界符；修改前拒绝同步写入选项中的取消信号
 * @param from - 源文件路径
 * @param to - 目标文件路径
 * @param options - 复制选项
 * @throws 目标边界校验、目录创建、路径渲染或文件复制失败时抛出带路径上下文的错误
 */
export function copyFileSync(
  from: string,
  to: string,
  options: CopyFileSyncOptions = {},
): void {
  try {
    validateCopyFileSyncOptions(options)
    const { mode, basedir, data, renderOptions } = options
    let destination = renderCopyPath(
      normalizeDotfilePath(to),
      data || {},
      renderOptions,
    )
    if (options.destinationRoot !== undefined) {
      destination = resolveWriteDestinationSync(
        destination,
        options.destinationRoot,
      )
    }

    mkdirSync(path.dirname(destination))

    if (basedir) {
      console.log(
        `${chalk.green('Copy: ')} ${path.relative(basedir, destination)}`,
      )
    }

    fs.copyFileSync(from, destination, mode)
  } catch (error) {
    const err = error as Error
    err.message = `Copy file from ${from} to ${to} failed: ${err.message}`
    throw err
  }
}

/**
 * 同步复制并渲染模板
 * @remarks 路径渲染遵循所选引擎的定界符；创建目录或文件前拒绝取消信号
 * @param from - 源文件路径
 * @param to - 目标文件路径
 * @param data - 模板数据
 * @param options - 复制选项
 * @throws 目标边界校验、模板读取、渲染或写入失败时抛出带路径上下文的错误
 */
export function copyTemplateSync(
  from: string,
  to: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
  options?: CopyFileSyncOptions,
): void {
  const { basedir, renderOptions, writeOptions } = options || {}

  try {
    validateCopyFileSyncOptions(options)
    const template = readFileSync(from)
    const content = renderTemplate(template, data, renderOptions)
    let destination = renderCopyPath(
      normalizeDotfilePath(to.replace(/\.tpl$/, '')),
      data,
      renderOptions,
    )
    if (options?.destinationRoot !== undefined) {
      destination = resolveWriteDestinationSync(
        destination,
        options.destinationRoot,
      )
    }

    mkdirSync(path.dirname(destination))

    if (basedir) {
      console.log(
        `${chalk.green('Write:')} ${path.relative(basedir, destination)}`,
      )
    }

    writeFileSync(destination, content, writeOptions)
  } catch (error) {
    const err = error as Error
    err.message = `Copy template from ${from} to ${to} failed: ${err.message}`
    throw err
  }
}

/**
 * 同步复制目录内容并渲染其中的 `.tpl` 模板
 * @remarks 枚举前检查源目录；不存在时保留 ENOENT，非目录时抛出 ENOTDIR；修改前拒绝取消信号
 * @param from - 源目录路径
 * @param to - 目标目录路径
 * @param data - 模板数据
 * @param options - 复制选项
 * @throws 文件枚举、复制或模板渲染失败时抛出带目录上下文的错误
 */
export function copyDirectorySync(
  from: string,
  to: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
  options: CopyFileSyncOptions = {},
): void {
  try {
    validateCopyFileSyncOptions(options)
    if (!fs.statSync(from).isDirectory()) {
      throw Object.assign(new Error(`Not a directory: ${from}`), {
        code: 'ENOTDIR',
      })
    }
    const files = globSync('**/*', {
      cwd: fs.realpathSync(from),
      dot: true,
      ignore: ['**/node_modules/**'],
    })

    for (const file of files) {
      const source = path.join(from, file)

      if (isDirectorySync(source)) {
        continue
      }

      const destination = path.join(to, file)

      if (file.endsWith('.tpl')) {
        copyTemplateSync(source, destination, data, options)
      } else {
        copyFileSync(source, destination, { ...options, data })
      }
    }
  } catch (error) {
    const err = error as Error
    err.message = `Copy directory from ${from} to ${to} failed: ${err.message}`
    throw err
  }
}
