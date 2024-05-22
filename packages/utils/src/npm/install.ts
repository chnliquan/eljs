import execa from 'execa'
import { PackageManager } from '../types'
import { getPackageManager } from './package-manager'

/**
 * 安装依赖选项
 */
export interface InstallDepsOpts {
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
 * @param opts 安装依赖选项
 */
export async function installDeps(opts: InstallDepsOpts): Promise<void> {
  const { dependencies, devDependencies, cwd = process.cwd() } = opts
  const packageManager = await getPackageManager(cwd)
  const devTag = '-D'

  if (dependencies) {
    installDependencies(dependencies)
  }

  if (devDependencies) {
    installDependencies(devDependencies, devTag)
  }

  function installDependencies(deps: string[], devStr?: string) {
    console.log(
      `${packageManager} install dependencies packages: ${deps.join(' ')}.`,
    )
    execa.sync(
      [packageManager, packageManager === 'npm' ? 'install' : 'add', devStr]
        .concat(deps)
        .filter(Boolean)
        .join(' '),
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
  cwd: string,
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
