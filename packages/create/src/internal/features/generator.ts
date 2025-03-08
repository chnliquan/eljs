import type {
  Api,
  CopyDirectoryOptions,
  CopyFileOptions,
  CopyTplOptions,
} from '@/types'
import { copyDirectory, copyFile, copyTpl } from '@eljs/utils'
import { resolve } from 'path'

export default (api: Api) => {
  api.registerMethod('resolve', (...paths: string[]) => {
    return resolve(api.paths.target, ...paths)
  })

  // 拷贝文件
  api.registerMethod('copyFile', (options: CopyFileOptions) => {
    copyFile({
      ...options,
      basedir: api.paths.target,
    })
  })

  // 拷贝模板文件
  api.registerMethod('copyTpl', (options: CopyTplOptions) => {
    copyTpl({
      ...options,
      basedir: api.paths.target,
    })
  })

  // 拷贝文件夹
  api.registerMethod('copyDirectory', (options: CopyDirectoryOptions) => {
    copyDirectory({
      ...options,
      basedir: api.paths.target,
    })
  })
}
