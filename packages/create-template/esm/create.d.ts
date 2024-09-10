import type { CreateTemplateOpts } from './types'
export declare function objectToArray(
  obj: Record<string, unknown>,
  valueIsNumber?: boolean,
): {
  title: string
  value: string | number
}[]
export declare class CreateTemplate {
  /**
   * 构造函数配置项
   */
  private _opts
  /**
   * 当前路径
   */
  private _cwd
  constructor(opts: CreateTemplateOpts)
  get cwd(): string
  get templateConfig(): import('./types').TemplateConfig
  run(projectName: string): Promise<void>
  private _formatTemplate
  private _getTemplateInfo
}
//# sourceMappingURL=create.d.ts.map
