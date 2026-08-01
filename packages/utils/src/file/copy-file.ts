import chalk from 'chalk'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'

import type { CopyFileOptions } from './copy-options'
import { normalizeDotfilePath } from './copy-path'
import { mkdir, mkdirSync } from './dir'
import { renderTemplate } from './render'

/**
 * 复制文件
 * @param from - 源文件路径
 * @param to - 目标文件路径
 * @param options - 复制选项
 * @returns 复制完成后结束
 * @throws 目录创建、路径渲染或文件复制失败时抛出带路径上下文的错误
 */
export async function copyFile(
  from: string,
  to: string,
  options: CopyFileOptions = {},
): Promise<void> {
  try {
    let destination = normalizeDotfilePath(to)
    const { mode, basedir, data, renderOptions } = options

    if (destination.includes('{{') || destination.includes('<%')) {
      destination = renderTemplate(destination, data || {}, renderOptions)
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
 * 同步复制文件
 * @param from - 源文件路径
 * @param to - 目标文件路径
 * @param options - 复制选项
 * @throws 目录创建、路径渲染或文件复制失败时抛出带路径上下文的错误
 */
export function copyFileSync(
  from: string,
  to: string,
  options: CopyFileOptions = {},
): void {
  try {
    let destination = normalizeDotfilePath(to)
    const { mode, basedir, data, renderOptions } = options

    if (destination.includes('{{') || destination.includes('<%')) {
      destination = renderTemplate(destination, data || {}, renderOptions)
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
