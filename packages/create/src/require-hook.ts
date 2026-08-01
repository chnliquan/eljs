// https://github.com/vercel/next.js/blob/canary/packages/next/src/server/require-hook.ts
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
const localRequire = createRequire(import.meta.url)
const createRootPath = path.dirname(localRequire.resolve('../package.json'))
const utilsRootPath = path.dirname(
  path.dirname(localRequire.resolve('@eljs/utils')),
)

/**
 * 模版插件中包名到当前 create 运行时包目录的映射
 *
 * @internal
 */
export const hookPropertyMap: ReadonlyMap<string, string> = new Map([
  ['@eljs/create', createRootPath],
  ['@eljs/utils', utilsRootPath],
])

let activeConsumers = 0
let previousResolveFilename: ResolveFilename | undefined
let installedResolveFilename: ResolveFilename | undefined

/**
 * 在插件加载期间安装 create 专用 CommonJS 模块解析映射
 *
 * @remarks
 * 多个并行调用共享同一个 Hook 并通过引用计数释放；释放时若其他库已替换解析器，
 * 不会覆盖对方的实现
 *
 * @returns 幂等的释放函数，最后一个调用方释放后恢复原解析器
 * @internal
 */
export function installRequireHook(): () => void {
  if (activeConsumers === 0) {
    previousResolveFilename = mod._resolveFilename
    const resolveFilename = previousResolveFilename
    installedResolveFilename = function (
      request: string,
      parent: NodeModule | undefined,
      isMain: boolean,
      options?: { paths?: string[] },
    ): string {
      const hookResolved = hookPropertyMap.get(request)
      return resolveFilename.call(
        mod,
        hookResolved ?? request,
        parent,
        isMain,
        options,
      )
    }
    mod._resolveFilename = installedResolveFilename
  }

  activeConsumers += 1
  let disposed = false

  return () => {
    if (disposed) {
      return
    }

    disposed = true
    activeConsumers -= 1

    if (activeConsumers !== 0) {
      return
    }

    if (
      previousResolveFilename &&
      mod._resolveFilename === installedResolveFilename
    ) {
      mod._resolveFilename = previousResolveFilename
    }

    previousResolveFilename = undefined
    installedResolveFilename = undefined
  }
}
