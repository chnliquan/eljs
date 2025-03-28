import type { Api } from '@/types'
import {
  chalk,
  deepMerge,
  install,
  isObject,
  isPathExists,
  logger,
  readJson,
  writeJson,
  type PackageJson,
  type RunCommandOptions,
} from '@eljs/utils'
import { join } from 'node:path'

export default (api: Api) => {
  api.registerMethod(
    'extendPackage',
    (fn: (pkg: PackageJson) => PackageJson | PackageJson) => {
      const pkg = api.appData.pkg
      const toMerged = (typeof fn === 'function' ? fn(pkg) : fn) ?? {}
      api.appData.pkg = deepMerge(api.appData.pkg, toMerged)
    },
  )

  api.registerMethod(
    'install',
    async (
      args?: string[] | RunCommandOptions,
      options?: RunCommandOptions,
    ) => {
      const { packageManager = 'pnpm' } = api.appData

      console.log()
      logger.info('📦 Installing additional dependencies ...')

      if (isObject(args)) {
        options = args
        args = []
      }

      await install(packageManager, (args || []) as string[], {
        cwd: api.paths.target,
        stdout: 'inherit',
        ...options,
      })
    },
  )

  api.onGenerateDone(
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

  api.onGenerateDone(
    async () => {
      if (api.config.install) {
        await api.install()
      }

      logger.ready(
        `🎉 Created project ${chalk.cyan.bold(
          api.appData.projectName,
        )} successfully.`,
      )
    },
    {
      stage: Infinity,
    },
  )
}
