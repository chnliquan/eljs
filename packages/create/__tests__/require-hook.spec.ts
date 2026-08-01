import Module from 'node:module'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { hookPropertyMap, installRequireHook } from '../src/require-hook'

type ResolveFilename = (
  request: string,
  parent: NodeModule | undefined,
  isMain: boolean,
  options?: { paths?: string[] },
) => string

const mod = Module as unknown as { _resolveFilename: ResolveFilename }
const originalResolveFilename = mod._resolveFilename
const disposers: Array<() => void> = []

afterEach(() => {
  while (disposers.length) {
    disposers.pop()?.()
  }
  mod._resolveFilename = originalResolveFilename
})

describe('create require hook', () => {
  it('应该只声明 create 与 utils 的绝对路径映射', () => {
    expect([...hookPropertyMap.keys()].sort()).toEqual([
      '@eljs/create',
      '@eljs/utils',
    ])

    for (const mappedPath of hookPropertyMap.values()) {
      expect(path.isAbsolute(mappedPath)).toBe(true)
    }
  })

  it('应该只在显式安装期间映射模版运行时依赖', () => {
    const dispose = installRequireHook()
    disposers.push(dispose)

    expect(mod._resolveFilename).not.toBe(originalResolveFilename)
    expect(mod._resolveFilename('@eljs/create', module, false, {})).toContain(
      hookPropertyMap.get('@eljs/create'),
    )
    expect(mod._resolveFilename('path', module, false, {})).toBe('path')

    dispose()
    expect(mod._resolveFilename).toBe(originalResolveFilename)
  })

  it('应该通过引用计数支持重叠的插件加载生命周期', () => {
    const disposeFirst = installRequireHook()
    const installed = mod._resolveFilename
    const disposeSecond = installRequireHook()
    disposers.push(disposeFirst, disposeSecond)

    expect(mod._resolveFilename).toBe(installed)
    disposeFirst()
    expect(mod._resolveFilename).toBe(installed)
    disposeSecond()
    expect(mod._resolveFilename).toBe(originalResolveFilename)
  })

  it('释放函数应该幂等且不覆盖之后安装的第三方 Hook', () => {
    const dispose = installRequireHook()
    disposers.push(dispose)
    const thirdPartyHook = vi.fn(originalResolveFilename)
    mod._resolveFilename = thirdPartyHook

    dispose()
    dispose()

    expect(mod._resolveFilename).toBe(thirdPartyHook)
  })
})
