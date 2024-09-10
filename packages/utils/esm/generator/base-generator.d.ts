import { type Answers, type PromptObject } from 'prompts'
import {
  type CopyDirectoryOpts,
  type CopyFileOpts,
  type CopyTplOpts,
  type RenderTemplateOpts,
} from '../file'
export declare class BaseGenerator {
  /**
   * 目标文件基准路径
   */
  basedir: string | ((prompts: Record<string, any>) => string)
  /**
   * 问询结果
   */
  prompts: Answers<string>
  /**
   * 模版渲染配置项
   */
  renderTemplateOptions: RenderTemplateOpts | undefined
  private _basedir
  constructor(
    basedir: BaseGenerator['basedir'],
    renderTemplateOptions?: BaseGenerator['renderTemplateOptions'],
  )
  run(): Promise<void>
  prompting(): PromptObject<string> | Array<PromptObject<string>>
  writing(): Promise<void>
  copyFile(opts: CopyFileOpts): void
  copyTpl(opts: CopyTplOpts): void
  copyDirectory(opts: CopyDirectoryOpts): void
  checkDir(targetDir: string): true | Promise<boolean>
}
//# sourceMappingURL=base-generator.d.ts.map
