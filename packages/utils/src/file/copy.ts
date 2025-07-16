import chalk from 'chalk'
import { glob, globSync } from 'glob'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'

import { mkdir, mkdirSync } from './dir'
import { isDirectory, isDirectorySync } from './is'
import { readFile, readFileSync } from './read'
import { renderTemplate, type RenderTemplateOptions } from './render'
import { writeFile, writeFileSync } from './write'

/**
 * 拷贝文件选项
 */
export interface CopyFileOptions {
  /**
   * 复制模式
   */
  mode?: number
  /**
   * 文件基础路径，如果传入会打印日志
   */
  basedir?: string
  /**
   * 模板渲染数据
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: Record<string, any>
  /**
   * 渲染引擎的选项
   */
  renderOptions?: RenderTemplateOptions
}

/**
 * 拷贝文件
 * @param from 源文件路径
 * @param to 目标文件路径
 * @param options 选项
 */
export async function copyFile(
  from: string,
  to: string,
  options: CopyFileOptions = {},
): Promise<void> {
  try {
    let destFile = convertFilePrefix(to)
    const { mode, basedir, data, renderOptions } = options

    if (destFile.indexOf('{{') > -1 || destFile.indexOf('<%') > -1) {
      destFile = renderTemplate(destFile, data || {}, renderOptions)
    }

    await mkdir(path.dirname(destFile))

    if (basedir) {
      console.log(
        `${chalk.green('Copy: ')} ${path.relative(basedir, destFile)}`,
      )
    }

    await fsp.copyFile(from, destFile, mode)
  } catch (error) {
    const err = error as Error
    err.message = `Copy file from ${from} to ${to} failed: ${err.message}`
    throw err
  }
}

/**
 * 拷贝文件
 * @param from 源文件路径
 * @param to 目标文件路径
 * @param options 选项
 */
export function copyFileSync(
  from: string,
  to: string,
  options: CopyFileOptions = {},
): void {
  try {
    let destFile = convertFilePrefix(to)
    const { mode, basedir, data, renderOptions } = options

    if (destFile.indexOf('{{') > -1 || destFile.indexOf('<%') > -1) {
      destFile = renderTemplate(destFile, data || {}, renderOptions)
    }

    mkdirSync(path.dirname(destFile))

    if (basedir) {
      console.log(
        `${chalk.green('Copy: ')} ${path.relative(basedir, destFile)}`,
      )
    }

    fs.copyFileSync(from, destFile, mode)
  } catch (error) {
    const err = error as Error
    err.message = `Copy file from ${from} to ${to} failed: ${err.message}`
    throw err
  }
}

/**
 * 拷贝模版
 * @param from 源文件路径
 * @param to 目标文件路径
 * @param data 模版数据
 * @param options 选项
 */
export async function copyTpl(
  from: string,
  to: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
  options?: CopyFileOptions,
): Promise<void> {
  const { basedir, renderOptions } = options || {}
  const tpl = await readFile(from)

  try {
    const content = renderTemplate(tpl, data, renderOptions)
    let destFile = convertFilePrefix(to.replace(/\.tpl$/, ''))

    if (destFile.indexOf('{{') > -1 || destFile.indexOf('<%') > -1) {
      destFile = renderTemplate(destFile, data, renderOptions)
    }

    await mkdir(path.dirname(destFile))

    if (basedir) {
      console.log(
        `${chalk.green('Write:')} ${path.relative(basedir, destFile)}`,
      )
    }

    await writeFile(destFile, content)
  } catch (error) {
    const err = error as Error
    err.message = `Copy template from ${from} to ${to} failed: ${err.message}`
    throw err
  }
}

/**
 * 拷贝模版
 * @param from 源文件路径
 * @param to 目标文件路径
 * @param data 模版数据
 * @param options 选项
 */
export function copyTplSync(
  from: string,
  to: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
  options?: CopyFileOptions,
): void {
  const { basedir, renderOptions } = options || {}
  const tpl = readFileSync(from)

  try {
    const content = renderTemplate(tpl, data, renderOptions)
    let destFile = convertFilePrefix(to.replace(/\.tpl$/, ''))

    if (destFile.indexOf('{{') > -1 || destFile.indexOf('<%') > -1) {
      destFile = renderTemplate(destFile, data, renderOptions)
    }

    mkdirSync(path.dirname(destFile))

    if (basedir) {
      console.log(
        `${chalk.green('Write:')} ${path.relative(basedir, destFile)}`,
      )
    }

    writeFileSync(destFile, content)
  } catch (error) {
    const err = error as Error
    err.message = `Copy template from ${from} to ${to} failed: ${err.message}`
    throw err
  }
}

/**
 * 拷贝文件夹
 * @param from 源文件路径
 * @param to 目标文件路径
 * @param options 选项
 */
export async function copyDirectory(
  from: string,
  to: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
  options?: CopyFileOptions,
): Promise<void> {
  options = options || {}
  try {
    const files = await glob('**/*', {
      cwd: from,
      dot: true,
      ignore: ['**/node_modules/**'],
    })

    for (const file of files) {
      const srcFile = path.join(from, file)

      if (await isDirectory(srcFile)) {
        continue
      }

      const destFile = path.join(to, file)

      if (file.endsWith('.tpl')) {
        await copyTpl(srcFile, destFile, data, options)
      } else {
        await copyFile(srcFile, destFile, {
          ...options,
          data,
        })
      }
    }
  } catch (error) {
    const err = error as Error
    err.message = `Copy directory from ${from} to ${to} failed: ${err.message}`
    throw err
  }
}

/**
 * 拷贝文件夹
 * @param from 源文件路径
 * @param to 目标文件路径
 * @param data 模版数据
 * @param options 选项
 */
export function copyDirectorySync(
  from: string,
  to: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
  options?: CopyFileOptions,
) {
  options = options || {}
  try {
    const files = globSync('**/*', {
      cwd: from,
      dot: true,
      ignore: ['**/node_modules/**'],
    })

    for (const file of files) {
      const srcFile = path.join(from, file)

      if (isDirectorySync(srcFile)) {
        continue
      }

      const destFile = path.join(to, file)

      if (file.endsWith('.tpl')) {
        copyTplSync(srcFile, destFile, options)
      } else {
        copyFileSync(srcFile, destFile, {
          ...options,
          data,
        })
      }
    }
  } catch (error) {
    const err = error as Error
    err.message = `Copy directory from ${from} to ${to} failed: ${err.message}`
    throw err
  }
}

function convertFilePrefix(file: string, prefix = '-') {
  if (file.indexOf(prefix) === -1) {
    return file
  }

  return file
    .split('/')
    .map(filename => {
      // dotfiles are ignored when published to npm, therefore in templates
      // we need to use underscore instead (e.g. "_gitignore")
      if (filename.charAt(0) === prefix && filename.charAt(1) !== prefix) {
        return `.${filename.slice(1)}`
      }

      if (filename.charAt(0) === prefix && filename.charAt(1) === prefix) {
        return `${filename.slice(1)}`
      }

      return filename
    })
    .join('/')
}
