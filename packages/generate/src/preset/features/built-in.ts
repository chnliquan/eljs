import {
  deepMerge,
  installWithNpmClient,
  isFunction,
  logger,
} from '@eljs/utils'
import { existsSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import prettier from 'prettier'
import sortPackageJson from 'sort-package-json'
import { Api, ExtendPackageOpts } from '../../types'

function formatPkg(pkg: string) {
  const sortPkg = sortPackageJson(pkg)
  return prettier.format(sortPkg, {
    printWidth: 120,
    proseWrap: 'never',
    parser: 'json',
  })
}

export default (api: Api) => {
  // #region  更新package.json 的内容
  api.registerMethod({
    name: 'extendPackage',
    async fn(opts: ExtendPackageOpts) {
      const pkg = api.service.pkg
      const toMerge = (isFunction(opts) ? await opts(pkg) : opts) ?? {}
      api.service.pkg = deepMerge(api.service.pkg, toMerge)
    },
  })

  api.register({
    key: 'onGenerateDone',
    fn() {
      const pkgJSONPath = join(api.paths.absOutputPath, 'package.json')
      let pkg = api.service.pkg

      if (existsSync(pkgJSONPath)) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const originPkg = require(pkgJSONPath)
        pkg = deepMerge(originPkg, pkg)
      }

      if (Object.keys(pkg).length === 0) {
        logger.warn('pkg 为空对象, 不生成 package.json')
        return
      }

      writeFileSync(pkgJSONPath, formatPkg(JSON.stringify(pkg, null, 2)))
      logger.info('Generate package.json')
    },
    stage: Number.NEGATIVE_INFINITY - 1,
  })

  api.registerMethod({
    name: 'resolve',
    fn(...paths: string[]) {
      return resolve(api.service.target, ...paths)
    },
  })

  api.registerMethod({
    name: 'installDeps',
    fn() {
      const { npmClient = 'pnpm' } = api.appData

      logger.info('📦 Installing additional dependencies...')
      console.log()

      api.appData.installDeps = true

      installWithNpmClient({
        npmClient,
        cwd: api.paths.absOutputPath,
      })
    },
  })
}
