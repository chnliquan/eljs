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

  // 拷贝文件
  api.registerMethod({
    name: 'copyFile',
    fn(opts: CopyFileOpts) {
      copyFile({
        ...opts,
        basedir: api.target,
      })
    },
  })

  // 拷贝模板文件
  api.registerMethod({
    name: 'copyTpl',
    fn(opts: CopyTplOpts) {
      copyTpl({
        ...opts,
        basedir: api.target,
      })
    },
  })

  // 拷贝文件夹
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
