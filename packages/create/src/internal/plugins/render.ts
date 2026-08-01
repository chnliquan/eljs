import {
  extractCallDir,
  isDirectory,
  type RenderTemplateOptions,
} from '@eljs/utils'
import { basename, join, resolve } from 'node:path'

import { definePlugin } from '../../define'

export default definePlugin(context => {
  context.registerCapability(
    'render',
    async (
      path: string,
      data: object = {},
      options?: RenderTemplateOptions,
    ) => {
      const baseDir = extractCallDir(3)
      const srcFile = resolve(baseDir, path)

      if (await isDirectory(srcFile)) {
        await context.copyDirectory(srcFile, context.paths.target, data, {
          renderOptions: options,
        })
      } else {
        const destFile = join(
          context.paths.target,
          basename(path).replace(/\.tpl$/, ''),
        )

        if (srcFile.endsWith('.tpl')) {
          await context.copyTpl(srcFile, destFile, data, {
            renderOptions: options,
          })
        } else {
          await context.copyFile(srcFile, destFile, {
            data,
            renderOptions: options,
          })
        }
      }
    },
  )
})
