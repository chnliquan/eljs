import { PromptObject } from 'prompts'
import { existsSync, isDirectory, mkdirSync } from '../file'
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
   * 模版渲染数据
   */
  data?: Generator['data']
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
   * 模版渲染数据
   */
  public data:
    | Record<string, any>
    | ((prompts: Record<string, any>) => Record<string, any>)

  private _source = ''
  private _data = {}

  public constructor({
    source,
    target,
    basedir,
    questions,
    data,
    renderTemplateOptions,
  }: GeneratorOpts) {
    super(basedir || target, renderTemplateOptions)
    this.source = source
    this.target = target
    this.data = data || {}
    this.questions = questions || []
  }

  public prompting() {
    return this.questions
  }

  public async writing() {
    if (!existsSync(this.target)) {
      mkdirSync(this.target)
    } else {
      const override = await this.checkTargetDir(this.target)

      if (!override) {
        return
      }
    }

    if (isFunction(this.source)) {
      this._source = this.source(this.prompts)
    }

    if (isFunction(this.data)) {
      this._data = this.data(this.prompts)
    }

    const data = {
      ...this.prompts,
      ...this._data,
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
