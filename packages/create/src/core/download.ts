import {
  chalk,
  downloadGitRepo,
  downloadNpmRepo,
  getNpmInfo,
  logger,
  ora,
  PkgJSON,
  pkgNameAnalysis,
  readJSONSync,
  run,
} from '@eljs/utils'
import path from 'path'
import { TemplateInfo } from '../types'

export class Download {
  private _opts: TemplateInfo

  public constructor(opts: TemplateInfo) {
    this._opts = opts
  }

  public async download() {
    const { type, value } = this._opts

    switch (type) {
      case 'npm':
        return this._downloadNpm(value)
      case 'git':
        return this._downloadGitTemplate(value)
      default:
        logger.error('模板类型错误')
    }
  }

  private async _installDependencies(dist: string, spinner: ora.Ora) {
    try {
      const pkgJSON: PkgJSON = readJSONSync(path.join(dist, './package.json'))

      if (
        pkgJSON.dependencies &&
        Object.keys(pkgJSON.dependencies).length > 0
      ) {
        spinner.start('安装模板依赖...')
        await run('npm install --production', {
          cwd: dist,
          verbose: false,
        })
        spinner.succeed('模板依赖安装成功')
      }
    } catch (err) {
      console.log()
      logger.error(`模板依赖安装失败：${(err as Error).message}`)
    }
  }

  private async _downloadNpm(name: string) {
    const spinner = ora(`模板下载中...`).start()

    try {
      const [pkgName, pkgVersion] = pkgNameAnalysis(name)
      const data = await getNpmInfo(pkgName, {
        version: pkgVersion,
      })

      if (!data) {
        throw new Error(`模板 ${chalk.cyanBright(pkgName)} 不存在`)
      }

      const { tarball } = data.dist
      const templateDir = await downloadNpmRepo(tarball)

      await this._installDependencies(templateDir, spinner)
      spinner.succeed('模板下载成功')
      return templateDir
    } catch (err) {
      spinner.fail('模板下载失败')
      throw new Error((err as Error).message)
    }
  }

  private async _downloadGitTemplate(url: string) {
    const spinner = ora(`模板下载中...`).start()

    try {
      const templateDir = await downloadGitRepo(url)

      spinner.succeed('模板下载成功')
      await this._installDependencies(templateDir, spinner)
      return templateDir
    } catch (err) {
      spinner.fail('模板下载失败')
      throw new Error((err as Error).message)
    }
  }
}
