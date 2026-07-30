import type { Answers, PromptObject } from 'prompts'

import { isDirectorySync, isPathExistsSync, mkdirSync } from '../file'
import { isFunction } from '../type'
import { BaseGenerator } from './base-generator'

export interface GeneratorOptions {
  /**
   * 模版文件夹路径
   */
  src: Generator['src']
  /**
   * 目标文件夹路径
   */
  dest: Generator['dest']
  /**
   * 目标文件夹基准路径，默认为 `dest`
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
   * 模版渲染选项
   */
  renderTemplateOptions?: Generator['renderTemplateOptions']
  /**
   * 模版写入完成回调函数
   */
  onGeneratorDone?: Generator['onGeneratorDone']
}

interface GeneratorDoneCtx {
  /**
   * 源文件路径
   */
  src: string
  /**
   * 木笔文件路径
   */
  dest: string
  /**
   * 模版渲染数据
   */

  data: object
}

export class Generator extends BaseGenerator {
  /**
   * 模版文件夹路径
   */

  public src: string | ((prompts: Answers<string>) => string)
  /**
   * 目标文件夹路径
   */

  public dest: string | ((prompts: Answers<string>) => string)
  /**
   * 问询列表
   */
  public questions: PromptObject[]
  /**
   * 模版渲染数据
   */
  public data: object | ((prompts: Answers<string>) => object)
  /**
   * 模版写入完成回调函数
   */
  public onGeneratorDone?: (ctx: GeneratorDoneCtx) => void | Promise<void>

  private _dest = ''
  private _src = ''
  private _data: object = {}

  public constructor({
    src,
    dest,
    basedir,
    questions,
    data,
    renderTemplateOptions,
    onGeneratorDone,
  }: GeneratorOptions) {
    super(basedir || dest, renderTemplateOptions)
    this.src = src
    this.dest = dest
    this.data = data || {}
    this.questions = questions || []
    this.onGeneratorDone = onGeneratorDone
  }

  public async run() {
    await super.run()

    if (this.onGeneratorDone) {
      await this.onGeneratorDone({
        src: this._src,
        dest: this._dest,
        data: this._data,
      })
    }
  }

  public prompting() {
    return this.questions || []
  }

  public async writing() {
    if (isFunction(this.dest)) {
      this._dest = this.dest(this.prompts)
    } else {
      this._dest = this.dest
    }

    if (!isPathExistsSync(this._dest)) {
      mkdirSync(this._dest)
    } else {
      const overwrite = await this.checkDir(this._dest)

      if (!overwrite) {
        return
      }
    }

    if (isFunction(this.src)) {
      this._src = this.src(this.prompts)
    } else {
      this._src = this.src
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

    if (isDirectorySync(this._src)) {
      await this.copyDirectory(this._src, this._dest, data)
    } else {
      if (this._src.endsWith('.tpl')) {
        await this.copyTpl(this._src, this._dest, data)
      } else {
        await this.copyFile(this._src, this._dest, data)
      }
    }
  }
}
