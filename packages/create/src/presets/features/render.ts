import { extractCallDir, isDirectory, RenderTemplateOptions } from '@eljs/utils'
import { join, resolve } from 'path'
import { Api } from '../../types'

export default (api: Api) => {
  // 复制文件夹
  api.registerMethod({
    name: 'render',
    fn(
      path: string,
      data: Record<string, any> = {},
      opts?: RenderTemplateOptions,
    ) {
      const baseDir = extractCallDir(3)
      const srcFile = resolve(baseDir, path)

      if (isDirectory(srcFile)) {
        api.copyDirectory({
          from: srcFile,
          to: api.paths.absOutputPath,
          data,
          opts,
        })
      } else {
        const destFile = join(
          api.paths.absOutputPath,
          srcFile.replace(/\.tpl$/, ''),
        )

        if (srcFile.endsWith('.tpl')) {
          api.copyTpl({
            from: srcFile,
            to: destFile,
            data,
            opts,
          })
        } else {
          api.copyFile({
            from: srcFile,
            to: destFile,
            data,
            opts,
          })
        }
      }
    },
  })
}
