import type { Template } from '@/types'
import {
  chalk,
  downloadGitRepo,
  downloadNpmTarball,
  getNpmPackage,
  pkgNameAnalysis,
  readJson,
  runCommand,
  type PackageJson,
} from '@eljs/utils'
import path from 'node:path'
import ora, { type Ora } from 'ora'

export class Download {
  /**
   * 构造函数参数
   */
  public constructorOptions: Template
  /**
   * spinner
   */
  private _spinner: Ora

  public constructor(options: Template) {
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
          `Download type must be npm or git, but got ${chalk.bold(type)}`,
        )
    }
  }

  /**
   * 下载 npm 压缩包
   * @param name 包名
   * @param registry 源仓库
   */
  private async _downloadNpmTarball(name: string, registry?: string) {
    const { name: pkgName, version } = pkgNameAnalysis(name)
    const data = await getNpmPackage(pkgName, {
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
    this._spinner.start(`Downloading ${projectName}`)

    try {
      const { tarball } = data.dist
      const templateDir = await downloadNpmTarball(tarball)
      this._spinner.succeed()
      await this._installDependencies(templateDir, projectName)
      return templateDir
    } catch (error) {
      this._spinner.fail()
      const err = error as Error
      err.message = `Download ${projectName} failed: ${err.message}`
      throw err
    }
  }

  /**
   * 下载 git
   * @param url git url
   */
  private async _downloadGit(url: string) {
    this._spinner.start(`Downloading ${url}`)

    try {
      const templateDir = await downloadGitRepo(url)
      this._spinner.succeed()
      await this._installDependencies(templateDir, url)
      return templateDir
    } catch (error) {
      this._spinner.fail()
      const err = error as Error
      err.message = `Download ${url} failed: ${err.message}`
      throw err
    }
  }

  /**
   * 安装依赖
   * @param root 项目根目录
   * @param projectName 项目名称
   */
  private async _installDependencies(root: string, projectName: string) {
    try {
      const pkg: PackageJson = await readJson(path.join(root, './package.json'))

      if (pkg.dependencies && Object.keys(pkg.dependencies)?.length > 0) {
        this._spinner.start(`Installing ${projectName}`)
        await runCommand('npm install --production', {
          cwd: root,
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
