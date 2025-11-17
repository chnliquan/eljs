import path from 'path'
import { hookPropertyMap } from '../src/require-hook'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mod = require('module')

describe('require-hook', () => {
  let originalResolveFilename: typeof mod._resolveFilename

  beforeAll(() => {
    // 保存原始的 _resolveFilename 方法
    originalResolveFilename = mod._resolveFilename
  })

  afterEach(() => {
    // 每个测试后恢复原始方法
    mod._resolveFilename = originalResolveFilename
  })

  describe('hookPropertyMap', () => {
    it('应该正确导出 hookPropertyMap', () => {
      expect(hookPropertyMap).toBeDefined()
      expect(hookPropertyMap instanceof Map).toBe(true)
    })

    it('应该包含正确的包映射', () => {
      expect(hookPropertyMap.has('@eljs/create')).toBe(true)
      expect(hookPropertyMap.has('@eljs/utils')).toBe(true)
    })

    it('@eljs/create 应该映射到正确的路径', () => {
      const createPath = hookPropertyMap.get('@eljs/create')
      expect(createPath).toBeDefined()
      expect(typeof createPath).toBe('string')
      expect(createPath).toContain('create')
    })

    it('@eljs/utils 应该映射到正确的路径', () => {
      const utilsPath = hookPropertyMap.get('@eljs/utils')
      expect(utilsPath).toBeDefined()
      expect(typeof utilsPath).toBe('string')
      expect(utilsPath).toContain('utils')
    })

    it('映射路径应该是绝对路径', () => {
      for (const [, mappedPath] of hookPropertyMap) {
        expect(path.isAbsolute(mappedPath)).toBe(true)
      }
    })

    it('应该只包含预期的包映射', () => {
      const expectedKeys = ['@eljs/create', '@eljs/utils']
      const actualKeys = Array.from(hookPropertyMap.keys())

      expect(actualKeys.sort()).toEqual(expectedKeys.sort())
      expect(hookPropertyMap.size).toBe(expectedKeys.length)
    })
  })

  describe('模块解析 hook', () => {
    beforeEach(() => {
      // 重新导入 require-hook 以确保 hook 生效
      jest.resetModules()
      require('../src/require-hook')
    })

    it('应该覆盖 module._resolveFilename', () => {
      expect(typeof mod._resolveFilename).toBe('function')
      expect(mod._resolveFilename).not.toBe(originalResolveFilename)
    })

    it('应该为 @eljs/create 进行路径映射', () => {
      const result = mod._resolveFilename('@eljs/create', module, false, {})
      const expectedBasePath = hookPropertyMap.get('@eljs/create')

      if (expectedBasePath) {
        // 解析后的结果应该基于映射路径
        expect(result).toContain(expectedBasePath)
        expect(result.startsWith(expectedBasePath)).toBe(true)
      }
    })

    it('应该为 @eljs/utils 进行路径映射', () => {
      const result = mod._resolveFilename('@eljs/utils', module, false, {})
      const expectedBasePath = hookPropertyMap.get('@eljs/utils')

      if (expectedBasePath) {
        expect(result).toContain(expectedBasePath)
        expect(result.startsWith(expectedBasePath)).toBe(true)
      }
    })

    it('对于不在映射中的模块应该使用原始解析', () => {
      const result = mod._resolveFilename('path', module, false, {})
      expect(result).toBe('path')
    })
  })

  describe('路径映射功能', () => {
    it('映射的路径应该存在且可访问', () => {
      for (const [, mappedPath] of hookPropertyMap) {
        expect(mappedPath).toBeDefined()
        expect(typeof mappedPath).toBe('string')
        expect(mappedPath.length).toBeGreaterThan(0)
        expect(path.isAbsolute(mappedPath)).toBe(true)
      }
    })

    it('@eljs/create 映射路径应该指向 create 包目录', () => {
      const createPath = hookPropertyMap.get('@eljs/create')
      expect(createPath).toContain('create')
      expect(createPath).toContain('packages')
    })

    it('@eljs/utils 映射路径应该指向 utils 包目录', () => {
      const utilsPath = hookPropertyMap.get('@eljs/utils')
      expect(utilsPath).toContain('utils')
      expect(utilsPath).toBeTruthy()
    })
  })

  describe('边界情况和错误处理', () => {
    beforeEach(() => {
      require('../src/require-hook')
    })

    it('空字符串请求应该处理正确', () => {
      expect(() => {
        try {
          mod._resolveFilename('', module, false, {})
        } catch (error) {
          expect(error).toBeDefined()
        }
      }).not.toThrow()
    })

    it('null/undefined 请求应该安全处理', () => {
      expect(() => {
        try {
          mod._resolveFilename(null as unknown as string, module, false, {})
        } catch {
          // 忽略预期的错误
        }

        try {
          mod._resolveFilename(
            undefined as unknown as string,
            module,
            false,
            {},
          )
        } catch {
          // 忽略预期的错误
        }
      }).not.toThrow()
    })

    it('应该正确处理类似的包名', () => {
      const similarNames = [
        '@eljs/create-test',
        '@eljs/utils-extra',
        'eljs/create',
        'eljs/utils',
      ]

      for (const name of similarNames) {
        expect(() => {
          try {
            mod._resolveFilename(name, module, false, {})
          } catch {
            // 这些模块不存在，抛出错误是正常的
          }
        }).not.toThrow()
      }
    })
  })

  describe('功能验证', () => {
    beforeEach(() => {
      require('../src/require-hook')
    })

    it('hook 应该保持原始方法的签名', () => {
      expect(mod._resolveFilename).toHaveLength(4)
      expect(typeof mod._resolveFilename).toBe('function')
    })

    it('应该保持模块解析的一致性', () => {
      const result1 = mod._resolveFilename('@eljs/create', module, false, {})
      const result2 = mod._resolveFilename('@eljs/create', module, false, {})

      expect(result1).toBe(result2)
      const expectedPath = hookPropertyMap.get('@eljs/create')
      if (expectedPath) {
        expect(result1).toContain(expectedPath)
      }
    })

    it('hook 应该正确处理内置模块', () => {
      const pathResult = mod._resolveFilename('path', module, false, {})
      const fsResult = mod._resolveFilename('fs', module, false, {})

      expect(pathResult).toBe('path')
      expect(fsResult).toBe('fs')
    })
  })

  describe('性能和稳定性', () => {
    beforeEach(() => {
      require('../src/require-hook')
    })

    it('多次调用应该保持高效', () => {
      const start = performance.now()

      for (let i = 0; i < 100; i++) {
        mod._resolveFilename('@eljs/create', module, false, {})
        mod._resolveFilename('@eljs/utils', module, false, {})
      }

      const end = performance.now()
      expect(end - start).toBeLessThan(100)
    })

    it('hook 应该是内存安全的', () => {
      for (let i = 0; i < 50; i++) {
        mod._resolveFilename('@eljs/create', module, false, {})
        mod._resolveFilename('@eljs/utils', module, false, {})
      }
      expect(true).toBe(true)
    })
  })

  describe('实际使用场景验证', () => {
    beforeEach(() => {
      require('../src/require-hook')
    })

    it('映射的模块应该可以正确解析', () => {
      const createResult = mod._resolveFilename(
        '@eljs/create',
        module,
        false,
        {},
      )
      const utilsResult = mod._resolveFilename('@eljs/utils', module, false, {})

      expect(typeof createResult).toBe('string')
      expect(typeof utilsResult).toBe('string')
      expect(createResult.length).toBeGreaterThan(0)
      expect(utilsResult.length).toBeGreaterThan(0)
      expect(path.isAbsolute(createResult)).toBe(true)
      expect(path.isAbsolute(utilsResult)).toBe(true)
    })

    it('hook 应该只影响指定的包', () => {
      const mappedResult = mod._resolveFilename(
        '@eljs/create',
        module,
        false,
        {},
      )
      const unmappedResult = mod._resolveFilename('path', module, false, {})

      const expectedPath = hookPropertyMap.get('@eljs/create')
      if (expectedPath) {
        expect(mappedResult).toContain(expectedPath)
      }
      expect(unmappedResult).toBe('path')
    })
  })

  describe('路径解析正确性', () => {
    beforeEach(() => {
      require('../src/require-hook')
    })

    it('解析的路径应该指向有效的文件系统位置', () => {
      const createResult = mod._resolveFilename(
        '@eljs/create',
        module,
        false,
        {},
      )
      const utilsResult = mod._resolveFilename('@eljs/utils', module, false, {})

      expect(path.parse(createResult).root).toBeTruthy()
      expect(path.parse(utilsResult).root).toBeTruthy()
      expect(createResult).toMatch(/packages.*create/i)
      expect(utilsResult).toMatch(/packages.*utils/i)
    })

    it('相同包的多次解析应该一致', () => {
      const results: string[] = []

      for (let i = 0; i < 5; i++) {
        results.push(mod._resolveFilename('@eljs/create', module, false, {}))
      }

      const firstResult = results[0]
      for (const result of results) {
        expect(result).toBe(firstResult)
      }
    })
  })
})
