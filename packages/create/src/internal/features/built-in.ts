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
    async (fn: (pkg: PackageJson) => PackageJson | PackageJson) => {
      const pkg = api.appData.pkg
      const toMerge = (isFunction(fn) ? await fn(pkg) : fn) ?? {}
      api.appData.pkg = api.utils.deepMerge(api.appData.pkg, toMerge)
    },
  )

  api.register(
    'onGenerateDone',
    async () => {
      const pkgJsonPath = join(api.paths.target, 'package.json')
      let pkg = api.appData.pkg

      if (await isPathExists(pkgJsonPath)) {
        const originPackageJson = await readJson(pkgJsonPath)
        pkg = api.utils.deepMerge(originPackageJson, pkg)
      }

      if (Object.keys(pkg).length === 0) {
        return
      }

      // esm 语法需要使用动态 import 引入
      const { default: sortPackageJson } = await import('sort-package-json')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await writeJson(pkgJsonPath, sortPackageJson(pkg as Record<any, any>))
    },
    {
      stage: Number.NEGATIVE_INFINITY,
    },
  )

  api.register(
    'onGenerateDone',
    () => {
      api.utils.logger.done(
        `🎉  Created project ${chalk.cyanBright.bold(
          api.appData.projectName,
        )} successfully.`,
      )
    },
    {
      stage: Infinity,
    },
  )

  api.registerMethod('installDeps', async () => {
    const { packageManager = 'pnpm' } = api.appData

    logger.info('📦 Installing additional dependencies...')
    console.log()

    await install(api.paths.target, packageManager)
  })
}
