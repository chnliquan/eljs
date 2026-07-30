//https://github.com/vercel/next.js/blob/canary/packages/next/src/server/require-hook.ts
import Module, { createRequire } from 'node:module'
import path from 'node:path'

type ResolveFilename = (
  request: string,
  parent: NodeModule | undefined,
  isMain: boolean,
  options?: { paths?: string[] },
) => string

const mod = Module as unknown as {
  _resolveFilename: ResolveFilename
}
const localRequire = createRequire(
  typeof __filename === 'string' ? __filename : import.meta.url,
)
const resolveFilename = mod._resolveFilename
const createRootPath = path.dirname(localRequire.resolve('../package.json'))
const utilsRootPath = path.dirname(
  path.dirname(localRequire.resolve('@eljs/utils')),
)

export const hookPropertyMap = new Map([
  ['@eljs/create', createRootPath],
  ['@eljs/utils', utilsRootPath],
])

mod._resolveFilename = function (
  request: string,
  parent: NodeModule | undefined,
  isMain: boolean,
  options?: { paths?: string[] },
) {
  const hookResolved = hookPropertyMap.get(request)

  if (hookResolved) {
    request = hookResolved
  }

  return resolveFilename.call(mod, request, parent, isMain, options)
}
