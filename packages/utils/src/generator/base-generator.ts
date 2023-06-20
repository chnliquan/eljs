import prompts, { Answers, PromptObject } from 'prompts'
import {
  copyDirectory,
  CopyDirectoryOpts,
  copyFile,
  CopyFileOpts,
  copyTpl,
  CopyTplOpts,
  RenderTemplateOptions,
} from '../file'

export class BaseGenerator {
  /**
   * 目标文件基准路径
   */
  public basedir: string
  /**
   * 问询结果
   */
  public prompts: Answers<string>
  /**
   * 模版渲染配置项
   */
  public renderTemplateOptions: RenderTemplateOptions | undefined

  public constructor(
    basedir: string,
    renderTemplateOptions?: RenderTemplateOptions,
  ) {
    this.basedir = basedir
    this.prompts = {}
    this.renderTemplateOptions = renderTemplateOptions
  }

  public async run() {
    const questions = this.prompting()
    this.prompts = await prompts(questions)
    await this.writing()
  }

  public prompting(): PromptObject<string> | Array<PromptObject<string>> {
    return []
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async writing() {
    // ...
  }

  public copyFile(opts: CopyFileOpts) {
    copyFile({
      ...opts,
      opts: this.renderTemplateOptions,
      basedir: this.basedir,
    })
  }

  public copyTpl(opts: CopyTplOpts) {
    copyTpl({
      ...opts,
      opts: this.renderTemplateOptions,
      basedir: this.basedir,
    })
  }

  public copyDirectory(opts: CopyDirectoryOpts) {
    copyDirectory({
      ...opts,
      opts: this.renderTemplateOptions,
      basedir: this.basedir,
    })
  }
}
