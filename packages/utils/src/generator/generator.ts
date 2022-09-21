import { PromptObject } from 'prompts'
import { isDirectory, RenderTemplateOptions } from '../file'
import { BaseGenerator } from './base-generator'

export interface GeneratorOpts {
  /**
   * 源文件路径
   */
  path: Generator['path']
  /**
   * 目标文件路径
   */
  target: Generator['target']
  /**
   * 目标文件基准路径
   */
  basedir?: Generator['basedir']
  /**
   * 问询列表
   */
  questions?: Generator['questions']
  /**
   * 默认的问询结果
   */
  defaultPrompts?: Generator['defaultPrompts']
}

export class Generator extends BaseGenerator {
  /**
   * 源文件路径
   */
  public path: string
  /**
   * 目标文件路径
   */
  public target: string
  /**
   * 问询列表
   */
  public questions: PromptObject[]
  /**
   * 默认的问询结果
   */
  public defaultPrompts: Record<string, any>

  public constructor({
    path,
    target,
    defaultPrompts,
    questions,
    basedir,
  }: GeneratorOpts) {
    super(basedir || target)
    this.path = path
    this.target = target
    this.defaultPrompts = defaultPrompts || {}
    this.questions = questions || []
  }

  public prompting() {
    return this.questions
  }

  public async writing(opts?: RenderTemplateOptions) {
    const data = {
      ...this.defaultPrompts,
      ...this.prompts,
    }

    if (isDirectory(this.path)) {
      this.copyDirectory({
        from: this.path,
        to: this.target,
        data,
        opts,
      })
    } else {
      if (this.path.endsWith('.tpl')) {
        this.copyTpl({
          from: this.path,
          to: this.target,
          data,
          opts,
        })
      } else {
        this.copyFile({
          from: this.path,
          to: this.target,
          data,
          opts,
        })
      }
    }
  }
}
