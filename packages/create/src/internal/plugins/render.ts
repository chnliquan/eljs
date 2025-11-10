import {
  extractCallDir,
  isDirectory,
  type RenderTemplateOptions,
} from '@eljs/utils'
import { basename, join, resolve } from 'node:path'

import type { Api } from '../../types'

export default (api: Api) => {
  api.registerMethod(
    'render',
    async (
      path: string,
      data: object = {},
      options?: RenderTemplateOptions,
    ) => {
      const baseDir = extractCallDir(3)
      const srcFile = resolve(baseDir, path)

      if (await isDirectory(srcFile)) {
        await api.copyDirectory(srcFile, api.paths.target, data, {
          renderOptions: options,
        })
      } else {
        const destFile = join(
          api.paths.target,
          basename(path).replace(/\.tpl$/, ''),
        )

        if (srcFile.endsWith('.tpl')) {
          await api.copyTpl(srcFile, destFile, data, {
            renderOptions: options,
          })
        } else {
          await api.copyFile(srcFile, destFile, {
            data,
            renderOptions: options,
          })
        }
      }
    },
  )
}
