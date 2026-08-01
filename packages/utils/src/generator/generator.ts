import type { Answers, PromptObject } from 'prompts'

import { isDirectorySync, mkdirSync, pathExistsSync } from '../file'
import { isFunction } from '../guards'
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

/**
 * 生成完成回调接收的最终上下文
 */
interface GeneratorDoneCtx {
  /**
   * 源文件路径
   */
  src: string
  /**
   * 目标文件路径
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
    super(basedir ?? dest, renderTemplateOptions)
    this.src = src
    this.dest = dest
    this.data = data || {}
    this.questions = questions || []
    this.onGeneratorDone = onGeneratorDone
  }

  /**
   * 执行生成流程，并只在实际完成写入后调用完成回调
   *
   * @returns 是否完成写入
   */
  public async run(): Promise<boolean> {
    const completed = await super.run()

    if (!completed) {
      return false
    }

    if (this.onGeneratorDone) {
      await this.onGeneratorDone({
        src: this._src,
        dest: this._dest,
        data: this._data,
      })
    }

    return true
  }

  public prompting() {
    return this.questions || []
  }

  /**
   * 解析动态路径和模板数据并写入目标
   *
   * @returns 用户拒绝覆盖目录时返回 `false`，否则返回 `true`
   */
  public async writing(): Promise<boolean> {
    if (isFunction(this.dest)) {
      this._dest = this.dest(this.prompts)
    } else {
      this._dest = this.dest
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
    this._data = data

    if (isDirectorySync(this._src)) {
      if (!pathExistsSync(this._dest)) {
        mkdirSync(this._dest)
      } else {
        const overwrite = await this.checkDir(this._dest)

        if (!overwrite) {
          return false
        }
      }

      await this.copyDirectory(this._src, this._dest, data)
    } else {
      if (this._src.endsWith('.tpl')) {
        await this.copyTpl(this._src, this._dest, data)
      } else {
        await this.copyFile(this._src, this._dest, { data })
      }
    }

    return true
  }
}
