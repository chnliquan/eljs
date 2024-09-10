import type { generateFile, installDeps, updatePkgJSON } from '@eljs/utils'
import type { Plugin } from '../core/plugin'
import { GeneratorType } from '../enum'
import type { Args } from './service'
type GeneratorOptsWithoutEnableCheck = {
  key: string
  name: string
  description: string
  type: GeneratorType.Generate
  plugin: Plugin
  fn: {
    (opts: {
      args: Args
      generateFile: typeof generateFile
      updatePkgJSON: typeof updatePkgJSON
      installDeps: typeof installDeps
    }): void
  }
}
type GeneratorOptsWithEnableCheck = {
  key: string
  name: string
  description: string
  type: GeneratorType.Enable
  disabledDescription: string | (() => string)
  plugin: Plugin
  checkEnable: {
    (opts: { args: Args }): boolean
  }
  fn: {
    (opts: {
      args: Args
      generateFile: typeof generateFile
      updatePkgJSON: typeof updatePkgJSON
      installDeps: typeof installDeps
    }): void
  }
}
export type Generator =
  | GeneratorOptsWithEnableCheck
  | GeneratorOptsWithoutEnableCheck
export {}
//# sourceMappingURL=generator.d.ts.map
