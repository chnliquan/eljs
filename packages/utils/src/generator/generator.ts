import { isDirectorySync, isPathExistsSync, mkdirSync } from '@/file'
import { isFunction } from '@/type'
import type { PromptObject } from 'prompts'

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>
}

export class Generator extends BaseGenerator {
  /**
   * 模版文件夹路径
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public src: string | ((prompts: Record<string, any>) => string)
  /**
   * 目标文件夹路径
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public dest: string | ((prompts: Record<string, any>) => string)
  /**
   * 问询列表
   */
  public questions: PromptObject[]
  /**
   * 模版渲染数据
   */
  public data: // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Record<string, any> | ((prompts: Record<string, any>) => Record<string, any>)
  /**
   * 模版写入完成回调函数
   */
  public onGeneratorDone?: (ctx: GeneratorDoneCtx) => void | Promise<void>

  private _dest = ''
  private _src = ''
  private _data = {}

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
      this.onGeneratorDone({
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
