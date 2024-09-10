import type { PromptObject } from 'prompts'
import { BaseGenerator } from './base-generator'
export interface GeneratorOpts {
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
   * 模版渲染配置项
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
  data: Record<string, any>
}
export declare class Generator extends BaseGenerator {
  /**
   * 模版文件夹路径
   */
  src: string | ((prompts: Record<string, any>) => string)
  /**
   * 目标文件夹路径
   */
  dest: string | ((prompts: Record<string, any>) => string)
  /**
   * 问询列表
   */
  questions: PromptObject[]
  /**
   * 模版渲染数据
   */
  data:
    | Record<string, any>
    | ((prompts: Record<string, any>) => Record<string, any>)
  /**
   * 模版写入完成回调函数
   */
  onGeneratorDone?: (ctx: GeneratorDoneCtx) => void | Promise<void>
  private _dest
  private _src
  private _data
  constructor({
    src,
    dest,
    basedir,
    questions,
    data,
    renderTemplateOptions,
    onGeneratorDone,
  }: GeneratorOpts)
  run(): Promise<void>
  prompting(): PromptObject<string>[]
  writing(): Promise<void>
}
export {}
//# sourceMappingURL=generator.d.ts.map
