import {
  copyDirectory,
  copyFile,
  copyTpl,
  type CopyFileOptions,
} from '@eljs/utils/file'
import { resolve } from 'node:path'

import { definePlugin } from '../../define'

export default definePlugin(context => {
  context.registerCapability('resolve', (...paths: string[]) => {
    return resolve(context.paths.target, ...paths)
  })

  // 拷贝文件
  context.registerCapability('copyFile', async (from, to, options) => {
    await copyFile(from, to, {
      ...options,
      basedir: context.paths.target,
    })
  })

  // 拷贝模板文件
  context.registerCapability(
    'copyTpl',
    async (from, to, data, options: CopyFileOptions) => {
      await copyTpl(from, to, data, {
        ...options,
        basedir: context.paths.target,
      })
    },
  )

  // 拷贝文件夹
  context.registerCapability(
    'copyDirectory',
    async (from, to, data, options: CopyFileOptions) => {
      await copyDirectory(from, to, data, {
        ...options,
        basedir: context.paths.target,
      })
    },
  )
})
