import type { RunCommandOptions } from '@eljs/utils/cp'
import { pathExists, readJson, writeJson } from '@eljs/utils/file'
import { isObject } from '@eljs/utils/guards'
import { chalk, logger } from '@eljs/utils/logger'
import { install } from '@eljs/utils/npm'
import { deepMerge } from '@eljs/utils/object'
import type { PackageJson } from '@eljs/utils/types'
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
        pkg = mergePackageJson(pkg, toMerged)
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
        ...(context.config.signal ? { signal: context.config.signal } : {}),
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

      if (await pathExists(pkgJsonPath)) {
        const origin = await readJson(pkgJsonPath)
        pkg = mergePackageJson(origin, pkg)
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

/**
 * 按插件登记顺序合并 package.json，并对所有基础类型数组稳定去重
 *
 * @remarks
 * package.json 中的 `files`、`keywords`、`workspaces` 以及 lint-staged 命令数组
 * 都采用追加语义；稳定去重既保留先注册插件的顺序，也避免后续插件返回当前包快照时
 * 重复已有元素
 *
 * @param sources - 按生命周期顺序排列的包清单片段
 * @returns 合并且规范化数组后的新包清单
 */
function mergePackageJson(...sources: PackageJson[]): PackageJson {
  return dedupePackageJsonArrays(deepMerge(...sources)) as PackageJson
}

/**
 * 递归复制 package.json 值并稳定去重字符串、数字、布尔值和空值数组
 *
 * @param value - 深度合并后的 JSON 兼容值
 * @returns 数组完成稳定去重的新值
 */
function dedupePackageJsonArrays(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value.map(dedupePackageJsonArrays)
    const canDedupeByValue = items.every(
      item => item === null || typeof item !== 'object',
    )

    return canDedupeByValue ? [...new Set(items)] : items
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        dedupePackageJsonArrays(item),
      ]),
    )
  }

  return value
}
