import { chalk, isDirectory, mkdirSync, renderTemplate } from '@eljs/utils'
import { copyFileSync, readFileSync, writeFileSync } from 'fs'
import { glob } from 'glob'
import { dirname, join, relative, resolve } from 'path'
import { Api, CopyDirectory, CopyFileOpts, CopyTplOpts } from '../../types'

export default (api: Api) => {
  api.registerMethod({
    name: 'resolve',
    fn(...paths: string[]) {
      return resolve(api.service.target, ...paths)
    },
  })

  // 转换文件前缀，处理文件名的边界情况
  api.registerMethod({
    name: 'convertFilePrefix',
    fn(rawPath: string) {
      if (rawPath.indexOf('_') === -1) {
        return rawPath
      }

      return rawPath
        .split('/')
        .map(filename => {
          // dotfiles are ignored when published to npm, therefore in templates
          // we need to use underscore instead (e.g. "_gitignore")
          if (filename.charAt(0) === '_' && filename.charAt(1) !== '_') {
            return `.${filename.slice(1)}`
          }

          if (filename.charAt(0) === '_' && filename.charAt(1) === '_') {
            return `${filename.slice(1)}`
          }

          return filename
        })
        .join('/')
    },
  })

  // 复制文件
  api.registerMethod({
    name: 'copyFile',
    fn(opts: CopyFileOpts) {
      let destFile = api.convertFilePrefix(opts.to)

      if (destFile.indexOf('{{') > -1 || destFile.indexOf('<%') > -1) {
        destFile = renderTemplate(destFile, opts.data || {}, opts.opts)
      }

      mkdirSync(dirname(destFile))
      console.log(`${chalk.green('Copy: ')} ${relative(api.target, destFile)}`)
      copyFileSync(opts.from, api.convertFilePrefix(destFile))
    },
  })

  // 复制模板文件
  api.registerMethod({
    name: 'copyTpl',
    fn(opts: CopyTplOpts) {
      const tpl = readFileSync(opts.from, 'utf-8')
      const content = renderTemplate(tpl, opts.data, opts.opts)

      let destFile = api.convertFilePrefix(opts.to)

      if (destFile.indexOf('{{') > -1 || destFile.indexOf('<%') > -1) {
        destFile = renderTemplate(destFile, opts.data, opts.opts)
      }

      mkdirSync(dirname(destFile))
      console.log(`${chalk.green('Write:')} ${relative(api.target, destFile)}`)
      writeFileSync(destFile, content, 'utf-8')
    },
  })

  // 复制文件夹
  api.registerMethod({
    name: 'copyDirectory',
    fn(opts: CopyDirectory) {
      const files = glob.sync('**/*', {
        cwd: opts.from,
        dot: true,
        ignore: ['**/node_modules/**'],
      })

      files.forEach(file => {
        const srcFile = join(opts.from, file)

        if (isDirectory(srcFile)) {
          return
        }

        if (file.endsWith('.tpl')) {
          api.copyTpl({
            ...opts,
            from: srcFile,
            to: join(opts.to, file.replace(/\.tpl$/, '')),
          })
        } else {
          const destFile = join(opts.to, file)
          api.copyFile({
            ...opts,
            from: srcFile,
            to: destFile,
          })
        }
      })
    },
  })
}
