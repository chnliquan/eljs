import { chalk, isDirectory, mkdirSync, renderTemplate } from '@eljs/utils'
import { copyFileSync, readFileSync, writeFileSync } from 'fs'
import { glob } from 'glob'
import { dirname, join, relative } from 'path'
import { Api, CopyDirectory, CopyFileOpts, CopyTplOpts } from '../../types'

export default (api: Api) => {
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
      const file = relative(api.target, opts.to)
      console.log(`${chalk.green('Copy: ')} ${file}`)
      const dest = api.convertFilePrefix(opts.to)
      mkdirSync(dirname(dest))
      copyFileSync(opts.from, dest)
    },
  })

  // 复制模板文件
  api.registerMethod({
    name: 'copyTpl',
    async fn(opts: CopyTplOpts) {
      const tpl = readFileSync(opts.from, 'utf-8')
      const content = await renderTemplate(tpl, opts.data, opts.opts)
      mkdirSync(dirname(opts.to))
      console.log(`${chalk.green('Write:')} ${relative(api.target, opts.to)}`)
      writeFileSync(api.convertFilePrefix(opts.to), content, 'utf-8')
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
        const src = join(opts.from, file)

        if (isDirectory(src)) {
          return
        }

        if (file.endsWith('.tpl')) {
          api.copyTpl({
            ...opts,
            from: src,
            to: join(opts.to, file.replace(/\.tpl$/, '')),
          })
        } else {
          const dest = join(opts.to, file)
          api.copyFile({
            from: src,
            to: dest,
          })
        }
      })
    },
  })
}
