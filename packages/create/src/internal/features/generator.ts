import type { Api, CopyDirectoryOpts, CopyFileOpts, CopyTplOpts } from '@/types'
import { copyDirectory, copyFile, copyTpl } from '@eljs/utils'
import { resolve } from 'path'

export default (api: Api) => {
  api.registerMethod({
    name: 'resolve',
    fn(...paths: string[]) {
      return resolve(api.service.target, ...paths)
    },
  })

  // 复制文件
  api.registerMethod({
    name: 'copyFile',
    fn(opts: CopyFileOpts) {
      copyFile({
        ...opts,
        basedir: api.target,
      })
    },
  })

  // 复制模板文件
  api.registerMethod({
    name: 'copyTpl',
    fn(opts: CopyTplOpts) {
      copyTpl({
        ...opts,
        basedir: api.target,
      })
    },
  })

  // 复制文件夹
  api.registerMethod({
    name: 'copyDirectory',
    fn(opts: CopyDirectoryOpts) {
      copyDirectory({
        ...opts,
        basedir: api.target,
      })
    },
  })
}
