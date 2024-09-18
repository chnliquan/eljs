import type { TemplateInfo } from '@/types'
import {
  chalk,
  downloadGitRepo,
  downloadNpmTarball,
  getNpmInfo,
  logger,
  ora,
  pkgNameAnalysis,
  readJSONSync,
  runCommand,
  type PkgJSON,
} from '@eljs/utils'
import path from 'path'

export class Download {
  private _opts: TemplateInfo
  private _spinner: ora.Ora

  public constructor(opts: TemplateInfo) {
    this._opts = opts
    this._spinner = ora()
  }

  public async download() {
    const { type, value, registry } = this._opts

    switch (type) {
      case 'npm':
        return this._downloadNpmTarball(value, registry)
      case 'git':
        return this._downloadGit(value)
      default:
        logger.error('模板类型错误')
    }
  }

  private async _downloadNpmTarball(name: string, registry?: string) {
    const { name: pkgName, version } = pkgNameAnalysis(name)
    const data = await getNpmInfo(pkgName, {
      version,
      registry,
    })

    if (!data) {
      throw new Error(
        `模板 ${chalk.cyanBright(
          `${pkgName}${version ? `@${version}` : ''}`,
        )} 获取失败`,
      )
    }

    const pkgSpec = chalk.cyanBright(`${pkgName}@${data.version}`)
    this._spinner.start(`Downloading ${pkgSpec}`)

    try {
      const { tarball } = data.dist
      const templateDir = await downloadNpmTarball(tarball)
      this._spinner.succeed()
      await this._installDependencies(templateDir, pkgSpec)
      return templateDir
    } catch (err) {
      this._spinner.fail()
      throw new Error((err as Error).message)
    }
  }

  private async _downloadGit(url: string) {
    this._spinner.start(`Downloading ${url}`)

    try {
      const templateDir = await downloadGitRepo(url)
      this._spinner.succeed()
      await this._installDependencies(templateDir, url)
      return templateDir
    } catch (err) {
      this._spinner.fail()
      throw new Error((err as Error).message)
    }
  }

  private async _installDependencies(dist: string, pkgSpec: string) {
    try {
      const pkgJSON: PkgJSON = readJSONSync(path.join(dist, './package.json'))

      if (
        pkgJSON.dependencies &&
        Object.keys(pkgJSON.dependencies).length > 0
      ) {
        this._spinner.start(`Installing ${pkgSpec}`)
        await runCommand('npm install --production', {
          cwd: dist,
          verbose: false,
        })
        this._spinner.succeed()
      }
    } catch (err) {
      console.log()
      this._spinner.fail()
      throw new Error((err as Error).message)
    }
  }
}
