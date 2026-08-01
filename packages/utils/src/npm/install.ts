import { run, type RunCommandOptions } from '../cp/command'
import { isArray, isObject } from '../guards'
import type { PackageManager } from '../types'
import { getPackageManager } from './package-manager'

/**
 * 安装依赖选项
 */
export interface InstallDepsOptions extends RunCommandOptions {
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
 * @param options - 依赖安装选项
 */
export async function installDeps(options?: InstallDepsOptions): Promise<void>
/**
 * 安装指定依赖
 * @param packageManager - 包管理器
 * @param options - 依赖安装选项
 */
export async function installDeps(
  packageManager: PackageManager,
  options?: InstallDepsOptions,
): Promise<void>
export async function installDeps(
  packageManager?: PackageManager | InstallDepsOptions,
  options?: InstallDepsOptions,
): Promise<void> {
  if (isObject(packageManager)) {
    options = packageManager
    packageManager = undefined
  }

  if (!packageManager) {
    packageManager = await getPackageManager(options?.cwd)
  }

  const { dependencies, devDependencies, ...rest } = options || {}

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
    await run(packageManager as PackageManager, cliArgs, rest)
  }
}

/**
 * 安装项目依赖
 * @param options - 选项
 */
export async function install(options?: RunCommandOptions): Promise<void>
/**
 * 安装项目依赖
 * @param args - 命令行参数
 * @param options - 选项
 */
export async function install(
  args: string[],
  options?: RunCommandOptions,
): Promise<void>
/**
 * 安装项目依赖
 * @param packageManager - 包管理器
 * @param options - 选项
 */
export async function install(
  packageManager: PackageManager,
  options?: RunCommandOptions,
): Promise<void>
/**
 * 安装项目依赖
 * @param packageManager - 包管理器
 * @param args - 命令行参数
 * @param options - 选项
 */
export async function install(
  packageManager: PackageManager,
  args: string[],
  options?: RunCommandOptions,
): Promise<void>
export async function install(
  packageManager?: PackageManager | string[] | RunCommandOptions,
  args?: string[] | RunCommandOptions,
  options?: RunCommandOptions,
): Promise<void> {
  if (isObject(packageManager)) {
    options = packageManager
    args = []
    packageManager = undefined
  }

  if (isArray(packageManager)) {
    options = args as RunCommandOptions
    args = packageManager
  }

  if (isObject(args)) {
    options = args
    args = []
  }

  if (!packageManager) {
    packageManager = await getPackageManager(options?.cwd)
  }

  const cliArgs = [
    packageManager === 'yarn' ? '' : 'install',
    ...(args ? (args as string[]) : []),
  ].filter(Boolean)

  await run(packageManager as PackageManager, cliArgs, options)
}
