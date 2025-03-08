import chalk from 'chalk'
import fs from 'fs'
import glob from 'glob'
import path from 'path'

import { mkdirSync } from './dir'
import { isDirectorySync } from './is'
import { renderTemplate, type RenderTemplateOptions } from './render'

/**
 * 文件拷贝选项
 */
export interface CopyFileOptions {
  /**
   * 模板文件路径
   */
  from: string
  /**
   * 目标文件路径
   */
  to: string
  /**
   * 文件基础路径，如果传入会打印日志
   */
  basedir?: string
  /**
   * 模板渲染需要的参数
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: Record<string, any>
  /**
   * 渲染引擎的参数
   */
  options?: RenderTemplateOptions
}

/**
 * 拷贝文件
 * @param options 文件拷贝选项
 */
export function copyFile(options: CopyFileOptions) {
  let destFile = convertFilePrefix(options.to)

  if (destFile.indexOf('{{') > -1 || destFile.indexOf('<%') > -1) {
    destFile = renderTemplate(destFile, options.data || {}, options.options)
  }

  mkdirSync(path.dirname(destFile))

  if (options.basedir) {
    console.log(
      `${chalk.green('Copy: ')} ${path.relative(options.basedir, destFile)}`,
    )
  }

  fs.copyFileSync(options.from, destFile)
}

/**
 * 模版拷贝选项
 */
export interface CopyTplOptions extends CopyFileOptions {
  /**
   * 模板渲染需要的参数
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>
}

/**
 * 拷贝模版
 * @param options 模版拷贝选项
 */
export function copyTpl(options: CopyTplOptions) {
  const tpl = fs.readFileSync(options.from, 'utf-8')
  const content = renderTemplate(tpl, options.data, options.options)

  let destFile = convertFilePrefix(options.to.replace(/\.tpl$/, ''))

  if (destFile.indexOf('{{') > -1 || destFile.indexOf('<%') > -1) {
    destFile = renderTemplate(destFile, options.data, options.options)
  }

  mkdirSync(path.dirname(destFile))

  if (options.basedir) {
    console.log(
      `${chalk.green('Write:')} ${path.relative(options.basedir, destFile)}`,
    )
  }

  fs.writeFileSync(destFile, content, 'utf-8')
}

/**
 * 文件夹拷贝选项
 */
export interface CopyDirectoryOptions extends CopyFileOptions {
  /**
   * 模板渲染需要的参数
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>
}

/**
 * 拷贝文件夹
 * @param options 文件夹拷贝选项
 */
export function copyDirectory(options: CopyDirectoryOptions) {
  const files = glob.sync('**/*', {
    cwd: options.from,
    dot: true,
    ignore: ['**/node_modules/**'],
  })

  files.forEach(file => {
    const srcFile = path.join(options.from, file)

    if (isDirectorySync(srcFile)) {
      return
    }

    const destFile = path.join(options.to, file)

    if (file.endsWith('.tpl')) {
      copyTpl({
        ...options,
        from: srcFile,
        to: destFile,
      })
    } else {
      copyFile({
        ...options,
        from: srcFile,
        to: destFile,
      })
    }
  })
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
