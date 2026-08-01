import {
  chalk,
  downloadGitRepository,
  downloadNpmTarball,
  getNpmPackage,
  pkgNameAnalysis,
  readJson,
  run,
  type PackageJson,
} from '@eljs/utils'
import path from 'node:path'
import ora, { type Ora } from 'ora'

import type { RemoteTemplate } from '../types'

/**
 * 下载构造函数
 */
export interface TemplateDownloadOptions extends RemoteTemplate {
  /**
   * 当前工作目录
   */
  cwd?: string
  /**
   * Allow dependency lifecycle scripts while preparing the template
   * @defaultValue false
   */
  allowScripts?: boolean
}

/**
 * 下载远程模版并按安全策略准备生产依赖
 */
export class TemplateDownloader {
  /**
   * 构造函数选项
   */
  public readonly constructorOptions: Readonly<TemplateDownloadOptions>
  /**
   * spinner
   */
  private readonly _spinner: Ora

  /**
   * 创建远程模版下载器
   *
   * @param options - 模版来源和依赖安装选项
   */
  public constructor(options: TemplateDownloadOptions) {
    this.constructorOptions = Object.freeze({ ...options })
    this._spinner = ora()
  }

  /**
   * 下载并准备远程模版
   *
   * @returns 可供生成器读取的模版根目录
   */
  public async download(): Promise<string> {
    const { type, value, registry } = this.constructorOptions

    switch (type) {
      case 'npm':
        return this._downloadNpmTarball(value, registry)
      case 'git':
        return this._downloadGit(value)
      default:
        throw new Error(
          `TemplateDownloader type must be \`npm\` or \`git\`, but got \`${type}\`.`,
        )
    }
  }

  /**
   * 下载 npm 压缩包
   * @param name - 包名
   * @param registry - 仓库源
   */
  private async _downloadNpmTarball(
    name: string,
    registry?: string,
  ): Promise<string> {
    const { name: pkgName, version } = pkgNameAnalysis(name)
    const data = await getNpmPackage(pkgName, {
      cwd: this.constructorOptions.cwd,
      version,
      registry,
    })

    if (!data) {
      throw new Error(
        `Access ${pkgName}${version ? `@${version}` : ''} failed.`,
      )
    }

    const projectName = chalk.cyan(`${pkgName}@${data.version}`)
    let templateRootPath: string

    try {
      this._spinner.start(`Downloading ${projectName}`)
      const { tarball } = data.dist
      templateRootPath = await downloadNpmTarball(tarball)
      this._spinner.succeed()
    } catch (error) {
      this._spinner.fail()
      const err = error as Error
      err.message = `TemplateDownloader ${projectName} failed: ${err.message}`
      throw err
    }

    await this._installDependencies(templateRootPath, projectName)
    return templateRootPath
  }

  /**
   * 下载 git
   * @param url - git url
   */
  private async _downloadGit(url: string): Promise<string> {
    let templateRootPath: string

    try {
      this._spinner.start(`Downloading ${url}`)
      templateRootPath = await downloadGitRepository(url)
      this._spinner.succeed()
    } catch (error) {
      this._spinner.fail()
      const err = error as Error
      err.message = `TemplateDownloader ${url} failed: ${err.message}`
      throw err
    }

    await this._installDependencies(templateRootPath, url)
    return templateRootPath
  }

  /**
   * 安装依赖
   * @param cwd - 当前工作目录
   * @param projectName - 项目名称
   */
  private async _installDependencies(
    cwd: string,
    projectName: string,
  ): Promise<void> {
    try {
      const { dependencies }: PackageJson =
        (await readJson(path.join(cwd, './package.json'))) || {}

      if (dependencies && Object.keys(dependencies).length > 0) {
        this._spinner.start(`Installing ${projectName}`)
        const installArgs = ['install', '--omit=dev']
        if (!this.constructorOptions.allowScripts) {
          installArgs.push('--ignore-scripts')
        }

        await run('npm', installArgs, {
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
