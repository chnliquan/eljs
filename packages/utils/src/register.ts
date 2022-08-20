import { Loader, transformSync } from 'esbuild'
import { extname } from 'path'
import { addHook } from 'pirates'

const COMPILE_EXTS = ['.ts', '.tsx', '.js', '.jsx']
const HOOK_EXTS = [...COMPILE_EXTS, '.mjs']

let registered = false
let files: string[] = []
// eslint-disable-next-line @typescript-eslint/no-empty-function
let revert: () => void = () => {}

export interface TransformOptions {
  code: string
  filename: string
}

function transform(opts: TransformOptions) {
  const { code, filename } = opts
  const ext = extname(filename).slice(1) as Loader

  files.push(filename)

  try {
    return transformSync(code, {
      sourcefile: filename,
      loader: ext,
      target: 'es2019',
      format: 'cjs',
      logLevel: 'error',
    }).code
  } catch (e) {
    throw new Error(`Parse file failed: [${filename}]`)
  }
}

export interface RegisterOptions {
  exts?: string[]
}

export function register(opts?: RegisterOptions) {
  files = []

  if (!registered) {
    revert = addHook((code, filename) => transform({ code, filename }), {
      ext: opts?.exts || HOOK_EXTS,
      ignoreNodeModules: true,
    })
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
