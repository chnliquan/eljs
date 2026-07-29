import { vi } from 'vitest'
import packageJson from './package.json'

Object.assign(globalThis, {
  __DEV__: true,
  __TEST__: true,
  __VERSION__: packageJson.version,
  __GLOBAL__: false,
  __ESM__: true,
  __NODE_JS__: true,
})

const originalExit = process.exit

process.exit = vi.fn(code => {
  if (process.env.ALLOW_PROCESS_EXIT === 'true') {
    return originalExit.call(process, code)
  }

  return undefined as never
}) as typeof process.exit
