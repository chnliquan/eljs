import type { Api } from '@/types'
import {
  extractCallDir,
  isDirectorySync,
  type RenderTemplateOptions,
} from '@eljs/utils'
import { join, resolve } from 'path'

export default (api: Api) => {
  // 复制文件夹
  api.registerMethod(
    'render',
    (
      path: string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: Record<string, any> = {},
      options?: RenderTemplateOptions,
    ) => {
      const baseDir = extractCallDir(3)
      const srcFile = resolve(baseDir, path)

      if (isDirectorySync(srcFile)) {
        api.copyDirectory({
          from: srcFile,
          to: api.paths.target,
          data,
          options,
        })
      } else {
        const destFile = join(api.paths.target, srcFile.replace(/\.tpl$/, ''))

        if (srcFile.endsWith('.tpl')) {
          api.copyTpl({
            from: srcFile,
            to: destFile,
            data,
            options,
          })
        } else {
          api.copyFile({
            from: srcFile,
            to: destFile,
            data,
            options,
          })
        }
      }
    },
  )
}
