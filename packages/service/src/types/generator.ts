import type { generateFile } from '@eljs/utils'
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
      updatePkgJSON: {
        (opts: { opts: object; cwd?: string }): void
      }
      installDeps: {
        (opts: {
          devDependencies?: string[]
          dependencies?: string[]
          cwd?: string
        }): void
      }
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
      updatePkgJSON: {
        (opts: { opts: object; cwd?: string }): void
      }
      installDeps: {
        (opts: {
          devDependencies?: string[]
          dependencies?: string[]
          cwd?: string
        }): void
      }
    }): void
  }
}

export type Generator =
  | GeneratorOptsWithEnableCheck
  | GeneratorOptsWithoutEnableCheck
