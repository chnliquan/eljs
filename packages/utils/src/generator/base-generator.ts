import prompts, { Answers, PromptObject } from 'prompts'
import {
  copyDirectory,
  CopyDirectoryOpts,
  copyFile,
  CopyFileOpts,
  copyTpl,
  CopyTplOpts,
} from '../file'

export class BaseGenerator {
  public basedir: string
  public prompts: Answers<string>

  public constructor(basedir: string) {
    this.basedir = basedir
    this.prompts = {}
  }

  public async run() {
    const questions = this.prompting()
    this.prompts = await prompts(questions)
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
      basedir: this.basedir,
    })
  }

  public copyTpl(opts: CopyTplOpts) {
    copyTpl({
      ...opts,
      basedir: this.basedir,
    })
  }

  public copyDirectory(opts: CopyDirectoryOpts) {
    copyDirectory({
      ...opts,
      basedir: this.basedir,
    })
  }
}
