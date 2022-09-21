import chalk from 'chalk'
import ejs, { Options } from 'ejs'
import fs from 'fs'
import glob from 'glob'
import mkdirp from 'mkdirp'
import Mustache, {
  OpeningAndClosingTags,
  PartialsOrLookupFn,
  RenderOptions,
} from 'mustache'
import os from 'os'
import parseJSON from 'parse-json'
import path from 'path'
import requireFromString from 'require-from-string'
import rimraf from 'rimraf'
import util from 'util'
import { v4 } from 'uuid'

import { PLATFORM, TEMP_DIR } from './const'
import { Implementor } from './types'

export function readJSONSync(file: string): Record<string, unknown> {
  try {
    return parseJSON(fs.readFileSync(file, 'utf8'))
  } catch (err) {
    return Object.create(null)
  }
}

export function writeJSONSync(
  file: string,
  data: Record<string, unknown>,
): void {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
}

export function safeWriteFileSync(file: string, data: string): void {
  const tmpFile = `${file}.${v4()}-tmp`

  try {
    fs.writeFileSync(tmpFile, data)
    fs.renameSync(tmpFile, file)
  } catch (err) {
    // 如果发生异常, 就将 tmpFile 删除掉
    if (fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile)
    }
  }
}

export function safeWriteJSONSync(
  file: string,
  data: Record<string, unknown>,
): void {
  const tmpFile = `${file}.${v4()}-tmp`

  try {
    writeJSONSync(tmpFile, data)
    fs.renameSync(tmpFile, file)
  } catch (err) {
    // 如果发生异常, 就将 tmpFile 删除掉
    if (fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile)
    }
  }
}

export function fstatSync(file: string, symlink?: boolean): fs.Stats | boolean {
  try {
    return symlink ? fs.lstatSync(file) : fs.statSync(file)
  } catch (err) {
    return false
  }
}

export function existsSync(file: string): boolean {
  return !!fstatSync(file)
}

export function getExecutableCmd(
  target: string,
  dirs?: string[],
): string | null {
  if (!dirs) {
    dirs = (process.env.PATH || '').split(':')
  }

  for (const dir of dirs) {
    const p = path.join(dir, target)

    if (existsSync(p)) {
      return p
    }
  }

  return null
}

export function isFile(file: string): boolean {
  const stat = fstatSync(file) as fs.Stats
  return stat ? stat.isFile() : false
}

export function isDirectory(dir: string): boolean {
  const stat = fstatSync(dir) as fs.Stats
  return stat ? stat.isDirectory() : false
}

export function isSymlink(link: string): boolean {
  const stat = fstatSync(link, true) as fs.Stats
  return stat ? stat.isSymbolicLink() : false
}

export function removeSync(path: string): void {
  rimraf.sync(path)
}

export function moveSync(src: string, dest: string, overwrite?: boolean): void {
  if (overwrite) {
    removeSync(dest)
    fs.renameSync(src, dest)
    return
  }

  if (existsSync(dest)) {
    throw Error(`The dest ${dest} already exists`)
  } else {
    fs.renameSync(src, dest)
  }
}

export function mkdirSync(dir: string): void {
  if (!existsSync(dir)) {
    mkdirp.sync(dir)
  }
}

export function tmpdir(random?: boolean): string {
  let tmpdir

  if (process.platform === PLATFORM.WIN) {
    tmpdir = os.tmpdir()
  } else {
    tmpdir = path.join(process.env.HOME || os.homedir(), TEMP_DIR)

    try {
      mkdirSync(tmpdir)
    } catch (err) {
      tmpdir = os.tmpdir()
    }
  }

  if (random) {
    const name = util.format(
      'tmp-%s-%s',
      Date.now(),
      Math.ceil(Math.random() * 1000),
    )

    tmpdir = path.join(tmpdir, name)
    mkdirSync(tmpdir)

    return tmpdir
  }

  return tmpdir
}

export function loadFile(filepath: string, implementor: Implementor) {
  const content = fs.readFileSync(filepath, 'utf-8')

  const ext = path.extname(filepath)
  const result = implementor.transformSync(content, {
    loader: ext.slice(1),
    format: 'cjs',
    sourcemap: false,
    minify: false,
  })

  const module = requireFromString(result?.code || '', filepath)
  return module.default || module
}

export interface RenderTemplateOptions {
  type?: 'mustache' | 'ejs'
  partials?: PartialsOrLookupFn
  tagsOrOptions?: OpeningAndClosingTags | RenderOptions
  options?: Options
}

export function renderTemplate(
  template: string,
  data: Record<string, unknown>,
  opts?: RenderTemplateOptions,
) {
  const { type = 'mustache', partials, tagsOrOptions, options } = opts || {}

  if (type === 'ejs') {
    return ejs.render(template, data, {
      ...options,
      async: false,
    })
  } else {
    return Mustache.render(template, data, partials, tagsOrOptions)
  }
}

export function convertFilePrefix(file: string, prefix = '-') {
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
  data?: Record<string, any>
  /**
   * 渲染引擎的参数
   */
  opts?: RenderTemplateOptions
}

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

export interface CopyTplOpts extends CopyFileOpts {
  /**
   * 模板渲染需要的参数
   */
  data: Record<string, any>
}

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

export interface CopyDirectoryOpts extends CopyFileOpts {
  /**
   * 模板渲染需要的参数
   */
  data: Record<string, any>
}

export function copyDirectory(opts: CopyDirectoryOpts) {
  const files = glob.sync('**/*', {
    cwd: opts.from,
    dot: true,
    ignore: ['**/node_modules/**'],
  })

  files.forEach(file => {
    const srcFile = path.join(opts.from, file)

    if (isDirectory(srcFile)) {
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
