import { extractCallDir, isDirectory, RenderTemplateOptions } from '@eljs/utils'
import { basename, join, resolve } from 'path'
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
      const baseDir = extractCallDir()
      const src = resolve(baseDir, path)

      if (isDirectory(src)) {
        api.copyDirectory({
          from: src,
          to: api.paths.absOutputPath,
          data,
          opts,
        })
      } else {
        const file = basename(src.replace(/\.tpl$/, ''))
        const dest = join(api.paths.absOutputPath, file)

        if (src.endsWith('.tpl')) {
          api.copyTpl({
            from: src,
            to: dest,
            data,
            opts,
          })
        } else {
          api.copyFile({
            from: src,
            to: dest,
          })
        }
      }
    },
  })
}
