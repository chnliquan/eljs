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

import { definePlugin } from '../../define'

type PackageExtension =
  PackageJson | ((pkg: PackageJson) => PackageJson | null | undefined)

export default definePlugin(context => {
  const packageExtensions: PackageExtension[] = []
  let canApplyPackageExtensions = false
  let applyingPackageExtensions = false

  const applyPackageExtensions = () => {
    if (!canApplyPackageExtensions || applyingPackageExtensions) {
      return
    }

    applyingPackageExtensions = true

    try {
      let pkg = context.appData.pkg || {}

      while (packageExtensions.length > 0) {
        const extension = packageExtensions.shift() as PackageExtension
        const toMerged =
          (typeof extension === 'function' ? extension(pkg) : extension) ?? {}
        pkg = deepMerge(pkg, toMerged)
        context.appData.pkg = pkg
      }
    } finally {
      applyingPackageExtensions = false
    }
  }

  context.registerCapability('extendPackage', (extension: PackageExtension) => {
    packageExtensions.push(extension)
    applyPackageExtensions()
  })

  context.registerCapability(
    'install',
    async (
      args?: string[] | RunCommandOptions,
      options?: RunCommandOptions,
    ) => {
      const { packageManager = 'pnpm' } = context.appData

      console.log()
      logger.info('📦 Installing additional dependencies ...')

      if (isObject(args)) {
        options = args
        args = []
      }

      await install(packageManager, (args || []) as string[], {
        cwd: context.paths.target,
        stdout: 'inherit',
        ...options,
      })
    },
  )

  context.onStart(
    () => {
      canApplyPackageExtensions = true
      applyPackageExtensions()
    },
    {
      stage: Number.NEGATIVE_INFINITY,
    },
  )

  context.onGenerateDone(
    async () => {
      applyPackageExtensions()

      const pkgJsonPath = join(context.paths.target, 'package.json')
      let pkg = context.appData.pkg

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
      // 先让普通完成钩子补充包配置，再在安装前持久化最终结果
      stage: Number.MAX_SAFE_INTEGER,
    },
  )

  context.onGenerateDone(
    async () => {
      if (context.config.install) {
        await context.install()
      }

      logger.ready(
        `🎉 Created project ${chalk.cyan.bold(
          context.appData.projectName,
        )} successfully.`,
      )
    },
    {
      stage: Infinity,
    },
  )
})
