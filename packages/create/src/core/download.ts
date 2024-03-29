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
    const { type, value, registry } = this._opts

    switch (type) {
      case 'npm':
        return this._downloadNpm(value, registry)
      case 'git':
        return this._downloadGit(value)
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

  private async _downloadNpm(name: string, registry?: string) {
    const spinner = ora(`模板下载中...`).start()

    try {
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

  private async _downloadGit(url: string) {
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
