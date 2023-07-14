import chalk from 'chalk'
import { readdirSync } from 'fs'
import prompts, { Answers, PromptObject } from 'prompts'
import { confirm } from '../cli'
import {
  copyDirectory,
  CopyDirectoryOpts,
  copyFile,
  CopyFileOpts,
  copyTpl,
  CopyTplOpts,
  RenderTemplateOptions,
} from '../file'
import { logger } from '../logger'
import { isFunction } from '../type'

const TARGET_DIR_WHITE_LIST = ['.git', 'LICENSE']

export class BaseGenerator {
  /**
   * 目标文件基准路径
   */
  public basedir: string | ((prompts: Record<string, any>) => string)
  /**
   * 问询结果
   */
  public prompts: Answers<string>
  /**
   * 模版渲染配置项
   */
  public renderTemplateOptions: RenderTemplateOptions | undefined

  private _basedir = ''

  public constructor(
    basedir: BaseGenerator['basedir'],
    renderTemplateOptions?: BaseGenerator['renderTemplateOptions'],
  ) {
    this.basedir = basedir
    this.prompts = {}
    this.renderTemplateOptions = renderTemplateOptions
  }

  public async run() {
    const questions = this.prompting()
    this.prompts = await prompts(questions)

    if (isFunction(this.basedir)) {
      this._basedir = this.basedir(this.prompts)
    } else {
      this._basedir = this.basedir
    }

    await this.writing()
  }

  public prompting(): PromptObject<string> | Array<PromptObject<string>> {
    return []
  }

  public async writing() {
    // ...
  }

  public copyFile(opts: CopyFileOpts) {
    copyFile({
      ...opts,
      opts: this.renderTemplateOptions,
      basedir: this._basedir,
    })
  }

  public copyTpl(opts: CopyTplOpts) {
    copyTpl({
      ...opts,
      opts: this.renderTemplateOptions,
      basedir: this._basedir,
    })
  }

  public copyDirectory(opts: CopyDirectoryOpts) {
    copyDirectory({
      ...opts,
      opts: this.renderTemplateOptions,
      basedir: this._basedir,
    })
  }

  public checkDir(targetDir: string) {
    const files = readdirSync(targetDir).filter(
      file => !TARGET_DIR_WHITE_LIST.includes(file),
    )

    if (files.length) {
      logger.warn(`当前文件夹 ${chalk.bold(targetDir)} 存在如下文件:\n`)
      files.forEach(file => console.log(' - ' + file))
      console.log()
      return confirm(`确定要覆盖当前文件夹吗?`, true)
    }

    return true
  }
}
