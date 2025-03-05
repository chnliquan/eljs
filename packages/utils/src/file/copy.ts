import chalk from 'chalk'
import fs from 'fs'
import glob from 'glob'
import path from 'path'

import { mkdirSync } from './dir'
import { isDirectorySync } from './is'
import { renderTemplate, type RenderTemplateOpts } from './render'

/**
 * 文件拷贝选项
 */
export interface CopyFileOpts {
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
  opts?: RenderTemplateOpts
}

/**
 * 拷贝文件
 * @param opts 文件拷贝选项
 */
export function copyFile(opts: CopyFileOpts) {
  let destFile = convertFilePrefix(opts.to)

  if (destFile.indexOf('{{') > -1 || destFile.indexOf('<%') > -1) {
    destFile = renderTemplate(destFile, opts.data || {}, opts.opts)
  }

  mkdirSync(path.dirname(destFile))

  if (opts.basedir) {
    console.log(
      `${chalk.green('Copy: ')} ${path.relative(opts.basedir, destFile)}`,
    )
  }

  fs.copyFileSync(opts.from, destFile)
}

/**
 * 模版拷贝选项
 */
export interface CopyTplOpts extends CopyFileOpts {
  /**
   * 模板渲染需要的参数
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>
}

/**
 * 拷贝模版
 * @param opts 模版拷贝选项
 */
export function copyTpl(opts: CopyTplOpts) {
  const tpl = fs.readFileSync(opts.from, 'utf-8')
  const content = renderTemplate(tpl, opts.data, opts.opts)

  let destFile = convertFilePrefix(opts.to.replace(/\.tpl$/, ''))

  if (destFile.indexOf('{{') > -1 || destFile.indexOf('<%') > -1) {
    destFile = renderTemplate(destFile, opts.data, opts.opts)
  }

  mkdirSync(path.dirname(destFile))

  if (opts.basedir) {
    console.log(
      `${chalk.green('Write:')} ${path.relative(opts.basedir, destFile)}`,
    )
  }

  fs.writeFileSync(destFile, content, 'utf-8')
}

/**
 * 文件夹拷贝选项
 */
export interface CopyDirectoryOpts extends CopyFileOpts {
  /**
   * 模板渲染需要的参数
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>
}

/**
 * 拷贝文件夹
 * @param opts 文件夹拷贝选项
 */
export function copyDirectory(opts: CopyDirectoryOpts) {
  const files = glob.sync('**/*', {
    cwd: opts.from,
    dot: true,
    ignore: ['**/node_modules/**'],
  })

  files.forEach(file => {
    const srcFile = path.join(opts.from, file)

    if (isDirectorySync(srcFile)) {
      return
    }

    const destFile = path.join(opts.to, file)

    if (file.endsWith('.tpl')) {
      copyTpl({
        ...opts,
        from: srcFile,
        to: destFile,
      })
    } else {
      copyFile({
        ...opts,
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
