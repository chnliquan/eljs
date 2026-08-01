import chalk from 'chalk'
import path from 'node:path'

import type { CopyFileOptions } from './copy-options'
import { normalizeDotfilePath } from './copy-path'
import { mkdir, mkdirSync } from './dir'
import { readFile, readFileSync } from './read'
import { renderTemplate } from './render'
import { writeFile, writeFileSync } from './write'

/**
 * 复制并渲染模板
 * @param from - 源文件路径
 * @param to - 目标文件路径
 * @param data - 模板数据
 * @param options - 复制选项
 * @returns 写入完成后结束
 * @throws 模板读取、渲染或写入失败时抛出带路径上下文的错误
 */
export async function copyTemplate(
  from: string,
  to: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
  options?: CopyFileOptions,
): Promise<void> {
  const { basedir, renderOptions } = options || {}

  try {
    const template = await readFile(from)
    const content = renderTemplate(template, data, renderOptions)
    let destination = normalizeDotfilePath(to.replace(/\.tpl$/, ''))

    if (destination.includes('{{') || destination.includes('<%')) {
      destination = renderTemplate(destination, data, renderOptions)
    }

    await mkdir(path.dirname(destination))

    if (basedir) {
      console.log(
        `${chalk.green('Write:')} ${path.relative(basedir, destination)}`,
      )
    }

    await writeFile(destination, content)
  } catch (error) {
    const err = error as Error
    err.message = `Copy template from ${from} to ${to} failed: ${err.message}`
    throw err
  }
}

/**
 * 同步复制并渲染模板
 * @param from - 源文件路径
 * @param to - 目标文件路径
 * @param data - 模板数据
 * @param options - 复制选项
 * @throws 模板读取、渲染或写入失败时抛出带路径上下文的错误
 */
export function copyTemplateSync(
  from: string,
  to: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
  options?: CopyFileOptions,
): void {
  const { basedir, renderOptions } = options || {}

  try {
    const template = readFileSync(from)
    const content = renderTemplate(template, data, renderOptions)
    let destination = normalizeDotfilePath(to.replace(/\.tpl$/, ''))

    if (destination.includes('{{') || destination.includes('<%')) {
      destination = renderTemplate(destination, data, renderOptions)
    }

    mkdirSync(path.dirname(destination))

    if (basedir) {
      console.log(
        `${chalk.green('Write:')} ${path.relative(basedir, destination)}`,
      )
    }

    writeFileSync(destination, content)
  } catch (error) {
    const err = error as Error
    err.message = `Copy template from ${from} to ${to} failed: ${err.message}`
    throw err
  }
}

/**
 * 复制并渲染模板
 * @param from - 源文件路径
 * @param to - 目标文件路径
 * @param data - 模板数据
 * @param options - 复制选项
 * @returns 写入完成后结束
 * @deprecated 请改用 {@link copyTemplate}
 */
export function copyTpl(
  from: string,
  to: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
  options?: CopyFileOptions,
): Promise<void> {
  return copyTemplate(from, to, data, options)
}

/**
 * 同步复制并渲染模板
 * @param from - 源文件路径
 * @param to - 目标文件路径
 * @param data - 模板数据
 * @param options - 复制选项
 * @deprecated 请改用 {@link copyTemplateSync}
 */
export function copyTplSync(
  from: string,
  to: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
  options?: CopyFileOptions,
): void {
  copyTemplateSync(from, to, data, options)
}
