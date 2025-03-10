import type { PackageManager } from '@/types'
import { execa } from 'execa'

import { getPackageManager } from './package-manager'

/**
 * 安装依赖选项
 */
export interface InstallDepsOptions {
  /**
   * 运行时依赖
   */
  dependencies?: string[]
  /**
   * 开发时依赖
   */
  devDependencies?: string[]
  /**
   * 当前工作目录
   */
  cwd?: string
}

/**
 * 安装指定依赖
 * @param options 可选配置项
 */
export async function installDeps(options: InstallDepsOptions): Promise<void> {
  const { dependencies, devDependencies, cwd = process.cwd() } = options
  const packageManager = await getPackageManager(cwd)

  if (dependencies) {
    await installDependencies(dependencies)
  }

  if (devDependencies) {
    await installDependencies(devDependencies, '-D')
  }

  async function installDependencies(deps: string[], devStr?: string) {
    console.log(
      `${packageManager} install dependencies packages: ${deps.join(' ')}.`,
    )

    await execa(
      packageManager,
      [packageManager === 'npm' ? 'install' : 'add', devStr]
        .concat(deps)
        .filter(Boolean) as string[],
      {
        encoding: 'utf8',
        cwd,
        env: {
          ...process.env,
        },
        stderr: 'pipe',
        stdout: 'pipe',
      },
    )
    console.log(`Install dependencies packages success.`)
  }
}

/**
 * 安装项目依赖
 * @param cwd 当前工作目录
 * @param packageManager 包管理器
 */
export async function install(
  cwd = process.cwd(),
  packageManager?: PackageManager,
): Promise<void> {
  if (!packageManager) {
    packageManager = await getPackageManager(cwd)
  }

  await execa(packageManager, [packageManager === 'npm' ? 'install' : ''], {
    stdio: 'inherit',
    cwd,
  })
}
