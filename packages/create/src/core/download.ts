import type { RemoteTemplate } from '@/types'
import {
  chalk,
  downloadGitRepo,
  downloadNpmTarball,
  getNpmPackage,
  isPathExists,
  pkgNameAnalysis,
  readJson,
  remove,
  run,
  type PackageJson,
} from '@eljs/utils'
import path from 'node:path'
import ora, { type Ora } from 'ora'

/**
 * 下载构造函数
 */
export interface DownloadOptions extends RemoteTemplate {
  /**
   * 当前工作目录
   */
  cwd?: string
}

export class Download {
  /**
   * 构造函数参数
   */
  public constructorOptions: DownloadOptions
  /**
   * spinner
   */
  private _spinner: Ora

  public constructor(options: DownloadOptions) {
    this.constructorOptions = options
    this._spinner = ora()
  }

  public async download(): Promise<string> {
    const { type, value, registry } = this.constructorOptions

    switch (type) {
      case 'npm':
        return this._downloadNpmTarball(value, registry)
      case 'git':
        return this._downloadGit(value)
      default:
        throw new Error(
          `Download type must be \`npm\` or \`git\`, but got ${chalk.bold(type)}`,
        )
    }
  }

  /**
   * 下载 npm 压缩包
   * @param name 包名
   * @param registry 仓库源
   */
  private async _downloadNpmTarball(name: string, registry?: string) {
    const { name: pkgName, version } = pkgNameAnalysis(name)
    const data = await getNpmPackage(pkgName, {
      cwd: this.constructorOptions.cwd,
      version,
      registry,
    })

    if (!data) {
      throw new Error(
        `Access ${chalk.cyanBright(
          `${pkgName}${version ? `@${version}` : ''}`,
        )} failed.`,
      )
    }

    const projectName = chalk.cyanBright(`${pkgName}@${data.version}`)
    let templateRootPath = ''

    try {
      try {
        this._spinner.start(`Downloading ${projectName}`)
        const { tarball } = data.dist
        templateRootPath = await downloadNpmTarball(tarball)
        this._spinner.succeed()
      } catch (error) {
        this._spinner.fail()
        const err = error as Error
        err.message = `Download ${projectName} failed: ${err.message}`
        throw err
      }

      await this._installDependencies(templateRootPath, projectName)
      return templateRootPath
    } finally {
      if (await isPathExists(templateRootPath)) {
        await remove(templateRootPath)
      }
    }
  }

  /**
   * 下载 git
   * @param url git url
   */
  private async _downloadGit(url: string) {
    let templateRootPath = ''

    try {
      try {
        this._spinner.start(`Downloading ${url}`)
        templateRootPath = await downloadGitRepo(url)
        this._spinner.succeed()
      } catch (error) {
        this._spinner.fail()
        const err = error as Error
        err.message = `Download ${url} failed: ${err.message}`
        throw err
      }

      await this._installDependencies(templateRootPath, url)
      return templateRootPath
    } finally {
      if (await isPathExists(templateRootPath)) {
        await remove(templateRootPath)
      }
    }
  }

  /**
   * 安装依赖
   * @param cwd 当前工作目录
   * @param projectName 项目名称
   */
  private async _installDependencies(cwd: string, projectName: string) {
    try {
      const pkg: PackageJson = await readJson(path.join(cwd, './package.json'))

      if (pkg?.dependencies?.length) {
        this._spinner.start(`Installing ${projectName}`)
        await run('npm', ['install', '--production'], {
          cwd,
        })
        this._spinner.succeed()
      }
    } catch (error) {
      this._spinner.fail()
      const err = error as Error
      err.message = `Install dependencies in ${projectName} failed: ${err.message}`
      throw err
    }
  }
}
