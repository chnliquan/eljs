import type { Api } from '@/types'
import {
  chalk,
  install,
  isFunction,
  isPathExists,
  logger,
  readJson,
  writeJson,
  type PackageJson,
} from '@eljs/utils'
import { join } from 'node:path'

export default (api: Api) => {
  api.registerMethod(
    'extendPackage',
    async (opts: (pkg: PackageJson) => PackageJson | PackageJson) => {
      const pkgJSON = api.pkgJSON
      const toMerge = (isFunction(opts) ? await opts(pkgJSON) : opts) ?? {}
      api.pkgJSON = api.utils.deepMerge(api.pkgJSON, toMerge)
    },
  )

  api.register({
    key: 'onGenerateDone',
    stage: Number.NEGATIVE_INFINITY,
    async fn() {
      const pkgJSONPath = join(api.paths.target, 'package.json')
      let pkgJSON = api.pkgJSON

      if (await isPathExists(pkgJSONPath)) {
        const originPackageJson = await readJson(pkgJSONPath)
        pkgJSON = api.utils.deepMerge(originPackageJson, pkgJSON)
      }

      if (Object.keys(pkgJSON).length === 0) {
        return
      }

      // esm 语法需要使用动态 import 引入
      const { default: sortPackageJson } = await import('sort-package-json')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await writeJson(pkgJSONPath, sortPackageJson(pkgJSON as Record<any, any>))
    },
  })

  api.register({
    key: 'onGenerateDone',
    stage: Infinity,
    fn() {
      api.utils.logger.done(
        `🎉  Created project ${chalk.cyanBright.bold(
          api.appData.projectName,
        )} successfully.`,
      )
    },
  })

  api.registerMethod('installDeps', async () => {
    const { packageManager = 'pnpm' } = api.appData

    logger.info('📦 Installing additional dependencies...')
    console.log()

    await install(api.paths.target, packageManager)
  })
}
