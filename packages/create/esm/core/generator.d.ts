export interface GeneratorOpts {
  targetDir: string
  projectName: string
  args?: Record<string, any>
  isLocalTemplate?: boolean
  isGenSchema?: boolean
}
export declare class Generator {
  private _opts
  constructor(opts: GeneratorOpts)
  create(templatePath?: string): Promise<void>
}
//# sourceMappingURL=generator.d.ts.map
