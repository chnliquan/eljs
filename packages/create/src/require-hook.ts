// https://github.com/vercel/next.js/blob/canary/packages/next/build/webpack/require-hook.ts
import path from 'path'

const hookPropertyMap = new Map([
  ['@eljs/create', path.dirname(require.resolve('../package.json'))],
])

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mod = require('module')

const resolveFilename = mod._resolveFilename
mod._resolveFilename = function (
  request: string,
  parent: any,
  isMain: boolean,
  options: any,
) {
  const hookResolved = hookPropertyMap.get(request)

  if (hookResolved) {
    request = hookResolved
  }

  return resolveFilename.call(mod, request, parent, isMain, options)
}

export { hookPropertyMap }
