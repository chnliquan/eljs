//https://github.com/vercel/next.js/blob/canary/packages/next/src/server/require-hook.ts
import path from 'path'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mod = require('module')

console.log('require-hook')
const resolveFilename = mod._resolveFilename
const createPath = path.dirname(require.resolve('../package.json'))
const utilsPath = path.dirname(require.resolve('@eljs/utils'))

console.log('require-hook:createPath', createPath)
console.log('require-hook:utilsPath', utilsPath)
const hookPropertyMap = new Map([
  ['@eljs/create', path.dirname(require.resolve('../package.json'))],
  // ['@eljs/utils', path.dirname(require.resolve('@eljs/utils'))],
])

mod._resolveFilename = function (
  request: string,
  parent: string,
  isMain: boolean,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: any,
) {
  const hookResolved = hookPropertyMap.get(request)
  console.log('require-hook:request', request)
  if (hookResolved) {
    request = hookResolved
  }
  console.log('require-hook:resolvedRequest', request)
  return resolveFilename.call(mod, request, parent, isMain, options)
}

export { hookPropertyMap }
