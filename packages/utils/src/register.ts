import { extname } from 'path'
import { addHook } from 'pirates'
import { Implementor } from './types'

const HOOK_EXTS = ['.ts', '.tsx']

let registered = false
let files: string[] = []
// eslint-disable-next-line @typescript-eslint/no-empty-function
let revert: () => void = () => {}

export interface TransformOpts {
  code: string
  filename: string
  implementor: Implementor
}

function transform(opts: TransformOpts) {
  const { code, filename, implementor } = opts
  const ext = extname(filename)

  files.push(filename)

  try {
    return implementor.transformSync(code, {
      sourcefile: filename,
      loader: ext.slice(1),
      target: 'es2019',
      format: 'cjs',
      logLevel: 'error',
    }).code
  } catch (e) {
    throw new Error(`Parse file failed: [${filename}]`)
  }
}

export interface RegisterOpts {
  implementor: Implementor
  ignoreNodeModules?: boolean
  exts?: string[]
}

export function register(opts: RegisterOpts) {
  const { implementor, ignoreNodeModules = true, exts = HOOK_EXTS } = opts
  files = []

  if (!registered) {
    revert = addHook(
      (code, filename) => transform({ code, filename, implementor }),
      {
        exts,
        ignoreNodeModules,
      },
    )
    registered = true
  }
}

export function getFiles() {
  return files
}

export function clearFiles() {
  files = []
}

export function restore() {
  revert()
  registered = false
}
