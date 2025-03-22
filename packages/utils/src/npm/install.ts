import type { PackageManager } from '@/types'
import execa from 'execa'

import { getPackageManager } from './package-manager'

/**
 * 安装依赖配置项
 */
export interface InstallDepsOptions {
  /**
   * 当前工作目录
   */
  cwd?: string
  /**
   * 包管理器
   */
  packageManager?: PackageManager
  /**
   * 运行时依赖
   */
  dependencies?: string[]
  /**
   * 开发时依赖
   */
  devDependencies?: string[]
}

/**
 * 安装指定依赖
 * @param options.cwd 当前工作目录
 * @param options.packageManager 包管理器
 * @param options.dependencies 运行时依赖
 * @param options.devDependencies 开发时依赖
 */
export async function installDeps(options?: InstallDepsOptions): Promise<void> {
  const {
    cwd = process.cwd(),
    packageManager = await getPackageManager(cwd),
    dependencies,
    devDependencies,
  } = options || {}

  if (dependencies) {
    await installDependencies(dependencies)
  }

  if (devDependencies) {
    await installDependencies(devDependencies, '-D')
  }

  async function installDependencies(deps: string[], devStr?: string) {
    const cliArgs = [
      packageManager === 'npm' ? 'install' : 'add',
      devStr,
      ...deps,
    ].filter(Boolean) as string[]
    await execa(packageManager, cliArgs, {
      encoding: 'utf8',
      cwd,
      env: process.env,
      stderr: 'inherit',
      stdout: 'inherit',
    })
  }
}

/**
 * 安装项目依赖配置项
 */
export interface InstallOptions {
  /**
   * 当前工作目录
   */
  cwd?: string
  /**
   * 命令行参数
   */
  args?: string[]
  /**
   * 包管理器
   */
  packageManager?: PackageManager
}

/**
 * 安装项目依赖
 * @param options.cwd 当前工作目录
 * @param options.args 命令行参数
 * @param options.packageManager 包管理器
 */
export async function install(options?: InstallOptions): Promise<void> {
  const {
    cwd = process.cwd(),
    args = [],
    packageManager = await getPackageManager(cwd),
  } = options || {}

  const cliArgs = [packageManager === 'yarn' ? '' : 'install', ...args].filter(
    Boolean,
  )

  await execa(packageManager, cliArgs, {
    stdio: 'inherit',
    cwd,
  })
}
