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
  /**
   * 文件写入完成回调函数
   */
  onGeneratorDone?: Generator['onGeneratorDone']
}

interface GeneratorDoneCtx {
  /**
   * 源文件路径
   */
  source: string
  /**
   * 木笔文件路径
   */
  target: string
  /**
   * 模版渲染数据
   */
  data: Record<string, any>
}

export class Generator extends BaseGenerator {
  /**
   * 源文件路径
   */
  public source: string | ((prompts: Record<string, any>) => string)
  /**
   * 目标文件路径
   */
  public target: string | ((prompts: Record<string, any>) => string)
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

  public onGeneratorDone?: (ctx: GeneratorDoneCtx) => void | Promise<void>

  private _target = ''
  private _source = ''
  private _data = {}

  public constructor({
    source,
    target,
    basedir,
    questions,
    data,
    renderTemplateOptions,
    onGeneratorDone,
  }: GeneratorOpts) {
    super(basedir || target, renderTemplateOptions)
    this.source = source
    this.target = target
    this.data = data || {}
    this.questions = questions || []
    this.onGeneratorDone = onGeneratorDone
  }

  public async run() {
    await super.run()

    if (this.onGeneratorDone) {
      this.onGeneratorDone({
        source: this._source,
        target: this._target,
        data: this._data,
      })
    }
  }

  public prompting() {
    return this.questions || []
  }

  public async writing() {
    if (isFunction(this.target)) {
      this._target = this.target(this.prompts)
    } else {
      this._target = this.target
    }

    if (!existsSync(this._target)) {
      mkdirSync(this._target)
    } else {
      const override = await this.checkTargetDir(this._target)

      if (!override) {
        return
      }
    }

    if (isFunction(this.source)) {
      this._source = this.source(this.prompts)
    } else {
      this._source = this.source
    }

    if (isFunction(this.data)) {
      this._data = this.data(this.prompts)
    } else {
      this._data = this.data
    }

    const data = {
      ...this.prompts,
      ...this._data,
    }

    if (isDirectory(this._source)) {
      this.copyDirectory({
        from: this._source,
        to: this._target,
        data,
      })
    } else {
      if (this._source.endsWith('.tpl')) {
        this.copyTpl({
          from: this._source,
          to: this._target,
          data,
        })
      } else {
        this.copyFile({
          from: this._source,
          to: this._target,
          data,
        })
      }
    }
  }
}
