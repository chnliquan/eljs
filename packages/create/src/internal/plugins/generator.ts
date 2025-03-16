import type { Api } from '@/types'
import {
  copyDirectory,
  copyFile,
  copyTpl,
  type CopyFileOptions,
} from '@eljs/utils'
import { resolve } from 'node:path'

export default (api: Api) => {
  api.registerMethod('resolve', (...paths: string[]) => {
    return resolve(api.paths.target, ...paths)
  })

  // 拷贝文件
  api.registerMethod('copyFile', async (from, to, options) => {
    await copyFile(from, to, {
      ...options,
      basedir: api.paths.target,
    })
  })

  // 拷贝模板文件
  api.registerMethod(
    'copyTpl',
    async (from, to, data, options: CopyFileOptions) => {
      await copyTpl(from, to, data, {
        ...options,
        basedir: api.paths.target,
      })
    },
  )

  // 拷贝文件夹
  api.registerMethod(
    'copyDirectory',
    async (from, to, data, options: CopyFileOptions) => {
      await copyDirectory(from, to, data, {
        ...options,
        basedir: api.paths.target,
      })
    },
  )
}
