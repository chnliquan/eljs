import type { CreateOpts, TemplateInfo } from '../types'
export declare function objectToArray(
  obj: Record<string, unknown>,
  valueIsNumber?: boolean,
): {
  title: string
  value: string | number
}[]
export declare class Create {
  /**
   * 构造函数配置项
   */
  private _opts
  /**
   * 当前路径
   */
  private _cwd
  /**
   * 本地模板路径
   */
  private _localTemplatePath?
  constructor(opts: CreateOpts)
  get cwd(): string
  get templateInfo(): TemplateInfo | undefined
  run(projectName: string): Promise<void>
  private _ensureLocalTemplate
  private _checkTargetDir
  private _getTemplatePath
  private _removeTemplate
}
//# sourceMappingURL=create.d.ts.map
