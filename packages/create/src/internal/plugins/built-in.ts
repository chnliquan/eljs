import type { Api } from '@/types'
import {
  chalk,
  deepMerge,
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
    (fn: (pkg: PackageJson) => PackageJson | PackageJson) => {
      const pkg = api.appData.pkg
      const toMerge = (isFunction(fn) ? fn(pkg) : fn) ?? {}
      api.appData.pkg = deepMerge(api.appData.pkg, toMerge)
    },
  )

  api.register(
    'onGenerateDone',
    async () => {
      const pkgJsonPath = join(api.paths.target, 'package.json')
      let pkg = api.appData.pkg

      if (await isPathExists(pkgJsonPath)) {
        const origin = await readJson(pkgJsonPath)
        pkg = deepMerge(origin, pkg)
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
      logger.done(
        `🎉  Created project ${chalk.cyanBright.bold(
          api.appData.projectName,
        )} successfully.`,
      )
    },
    {
      stage: Infinity,
    },
  )

  api.registerMethod('install', async (args: string[]) => {
    const { packageManager = 'pnpm' } = api.appData

    logger.info('📦 Installing additional dependencies...')
    console.log()

    await install({
      cwd: api.paths.target,
      args,
      packageManager,
    })
  })
}
