import type { TemplateInfo } from '../types'
export declare class Download {
  private _opts
  constructor(opts: TemplateInfo)
  download(): Promise<string | undefined>
  private _installDependencies
  private _downloadNpmTarball
  private _downloadGit
}
//# sourceMappingURL=download.d.ts.map
