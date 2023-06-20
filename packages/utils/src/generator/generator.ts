import { PromptObject } from 'prompts'
import { isDirectory } from '../file'
import { isFunction } from '../type'
import { BaseGenerator } from './base-generator'

export interface GeneratorOpts {
  /**
   * 源文件路径
   */
  source: Generator['source']
  /**
   * 目标文件路径
   */
  target: Generator['target']
  /**
   * 目标文件基准路径，默认为 target
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
  /**
   * 模版渲染配置项
   */
  renderTemplateOptions?: Generator['renderTemplateOptions']
}

export class Generator extends BaseGenerator {
  /**
   * 源文件路径
   */
  public source: string | ((prompts: Record<string, any>) => string)
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

  private _source = ''

  public constructor({
    source,
    target,
    basedir,
    questions,
    defaultPrompts,
    renderTemplateOptions,
  }: GeneratorOpts) {
    super(basedir || target, renderTemplateOptions)
    this.source = source
    this.target = target
    this.defaultPrompts = defaultPrompts || {}
    this.questions = questions || []
  }

  public prompting() {
    return this.questions
  }

  public async writing() {
    const data = {
      ...this.defaultPrompts,
      ...this.prompts,
    }

    if (isFunction(this.source)) {
      this._source = this.source(data)
    }

    if (isDirectory(this._source)) {
      this.copyDirectory({
        from: this._source,
        to: this.target,
        data,
      })
    } else {
      if (this._source.endsWith('.tpl')) {
        this.copyTpl({
          from: this._source,
          to: this.target,
          data,
        })
      } else {
        this.copyFile({
          from: this._source,
          to: this.target,
          data,
        })
      }
    }
  }
}
