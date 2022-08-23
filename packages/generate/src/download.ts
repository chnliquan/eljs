import {
  chalk,
  downloadGitRepo,
  downloadNpmRepo,
  getNpmInfo,
  logger,
  ora,
  pkgNameAnalysis,
} from '@eljs/utils'
import { TemplateInfo } from './types'

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

  private async _downloadNpm(name: string) {
    const spinner = ora(`下载模板中...`).start()
    try {
      const [pkgName, pkgVersion] = pkgNameAnalysis(name)
      const data = await getNpmInfo(pkgName, {
        version: pkgVersion,
      })

      if (!data) {
        throw Error()
      }

      const { tarball } = data.dist

      const templateDir = await downloadNpmRepo(tarball)

      spinner.succeed('下载模板成功')
      return templateDir
    } catch (error: any) {
      spinner.fail('模板下载失败')
      if (error && error.response) {
        logger.error(`模板下载失败模板 ${chalk.cyan(name)} 不存在`)
      } else {
        logger.error(error.message)
      }
    }
  }

  private async _downloadGitTemplate(url: string) {
    const spinner = ora(`下载模板中...`).start()

    try {
      const templateDir = await downloadGitRepo(url)
      spinner.succeed('下载模板成功')
      return templateDir
    } catch (error: any) {
      spinner.fail('模板下载失败')
      logger.error(error.message)
    }
  }
}
