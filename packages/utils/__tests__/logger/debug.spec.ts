/* eslint-disable @typescript-eslint/no-var-requires */
import debug from 'debug'

import { createDebugger } from '../../src/logger/debug'

// Mock 依赖项
jest.mock('debug')

describe('Debug 调试工具', () => {
  const mockDebug = debug as jest.MockedFunction<typeof debug>

  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.DEBUG
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('基本功能验证', () => {
    it('应该在enabled时创建调试函数', () => {
      const mockLogFn = jest.fn()
      const mockDebugInstance = Object.assign(mockLogFn, {
        enabled: true,
        namespace: 'test:enabled',
        inspectOpts: {},
      })

      mockDebug.mockReturnValue(mockDebugInstance as unknown as debug.Debugger)

      const debugFn = createDebugger('test:enabled')

      expect(mockDebug).toHaveBeenCalledWith('test:enabled')
      expect(typeof debugFn).toBe('function')

      if (debugFn) {
        debugFn('test message', { data: 'value' })
        expect(mockLogFn).toHaveBeenCalledWith('test message', {
          data: 'value',
        })
      }
    })

    it('应该在disabled时返回undefined', () => {
      const mockLogFn = jest.fn()
      const mockDebugInstance = Object.assign(mockLogFn, {
        enabled: false,
        namespace: 'test:disabled',
      })

      mockDebug.mockReturnValue(mockDebugInstance as unknown as debug.Debugger)

      const debugFn = createDebugger('test:disabled')

      expect(debugFn).toBeUndefined()
    })

    it('应该支持各种参数类型', () => {
      const mockLogFn = jest.fn()
      const mockDebugInstance = Object.assign(mockLogFn, {
        enabled: true,
        namespace: 'test:types',
      })

      mockDebug.mockReturnValue(mockDebugInstance as unknown as debug.Debugger)

      const debugFn = createDebugger('test:types')

      if (debugFn) {
        debugFn('string')
        debugFn('number', 42)
        debugFn('object', { key: 'value' })
        debugFn('array', [1, 2, 3])
        debugFn('multiple', 'args', true, null)

        expect(mockLogFn).toHaveBeenCalledTimes(5)
      }
    })
  })

  describe('depth 选项处理', () => {
    it('应该处理depth选项', () => {
      const mockLogFn = jest.fn()
      const mockDebugInstance = Object.assign(mockLogFn, {
        enabled: true,
        namespace: 'test:depth',
        inspectOpts: { depth: null },
      })

      mockDebug.mockReturnValue(mockDebugInstance as unknown as debug.Debugger)

      const debugFn = createDebugger('test:depth', { depth: 5 })

      expect(typeof debugFn).toBe('function')
    })

    it('应该在没有inspectOpts时安全处理', () => {
      const mockLogFn = jest.fn()
      const mockDebugInstance = Object.assign(mockLogFn, {
        enabled: true,
        namespace: 'test:no-inspect',
      })

      mockDebug.mockReturnValue(mockDebugInstance as unknown as debug.Debugger)

      const debugFn = createDebugger('test:no-inspect', { depth: 5 })

      expect(typeof debugFn).toBe('function')
    })

    it('应该处理各种depth值', () => {
      const depthCases = [0, 1, 5, -1, 999]

      depthCases.forEach(depthValue => {
        const mockLogFn = jest.fn()
        const mockDebugInstance = Object.assign(mockLogFn, {
          enabled: true,
          namespace: `test:depth${depthValue}`,
          inspectOpts: { depth: null },
        })

        mockDebug.mockReturnValue(
          mockDebugInstance as unknown as debug.Debugger,
        )

        const debugFn = createDebugger(`test:depth${depthValue}`, {
          depth: depthValue,
        })
        expect(typeof debugFn).toBe('function')
      })
    })
  })

  describe('onlyWhenFocused 逻辑测试', () => {
    it('应该在DEBUG包含namespace时启用', () => {
      process.env.DEBUG = 'test:focus'

      const mockLogFn = jest.fn()
      const mockDebugInstance = Object.assign(mockLogFn, {
        enabled: true,
        namespace: 'test:focus',
      })

      mockDebug.mockReturnValue(mockDebugInstance as unknown as debug.Debugger)

      const debugFn = createDebugger('test:focus', { onlyWhenFocused: true })

      expect(typeof debugFn).toBe('function')
    })

    it('应该在DEBUG不包含namespace时禁用', () => {
      process.env.DEBUG = 'other:pattern'

      const mockLogFn = jest.fn()
      const mockDebugInstance = Object.assign(mockLogFn, {
        enabled: true,
        namespace: 'test:focus',
      })

      mockDebug.mockReturnValue(mockDebugInstance as unknown as debug.Debugger)

      const debugFn = createDebugger('test:focus', { onlyWhenFocused: true })

      expect(debugFn).toBeUndefined()
    })

    it('应该使用自定义focus字符串', () => {
      process.env.DEBUG = 'custom:target'

      const mockLogFn = jest.fn()
      const mockDebugInstance = Object.assign(mockLogFn, {
        enabled: true,
        namespace: 'any:name',
      })

      mockDebug.mockReturnValue(mockDebugInstance as unknown as debug.Debugger)

      const debugFn = createDebugger('any:name', {
        onlyWhenFocused: 'custom:target',
      })

      expect(typeof debugFn).toBe('function')
    })

    it('应该在没有DEBUG时禁用focused模式', () => {
      delete process.env.DEBUG

      const mockLogFn = jest.fn()
      const mockDebugInstance = Object.assign(mockLogFn, {
        enabled: true,
        namespace: 'test:focus',
      })

      mockDebug.mockReturnValue(mockDebugInstance as unknown as debug.Debugger)

      const debugFn = createDebugger('test:focus', { onlyWhenFocused: true })

      expect(debugFn).toBeUndefined()
    })
  })

  describe('边界情况', () => {
    it('应该处理空namespace', () => {
      const mockLogFn = jest.fn()
      const mockDebugInstance = Object.assign(mockLogFn, {
        enabled: true,
        namespace: '',
      })

      mockDebug.mockReturnValue(mockDebugInstance as unknown as debug.Debugger)

      const debugFn = createDebugger('')

      expect(typeof debugFn).toBe('function')
    })

    it('应该处理特殊字符', () => {
      const mockLogFn = jest.fn()
      const mockDebugInstance = Object.assign(mockLogFn, {
        enabled: true,
        namespace: 'special',
      })

      mockDebug.mockReturnValue(mockDebugInstance as unknown as debug.Debugger)

      const specialNamespaces = ['test:dash', 'test_underscore', 'test.dot']

      specialNamespaces.forEach(namespace => {
        const debugFn = createDebugger(namespace)
        expect(typeof debugFn).toBe('function')
      })
    })

    it('应该处理组合选项', () => {
      process.env.DEBUG = 'combined:test'

      const mockLogFn = jest.fn()
      const mockDebugInstance = Object.assign(mockLogFn, {
        enabled: true,
        namespace: 'combined:test',
        inspectOpts: { depth: null },
      })

      mockDebug.mockReturnValue(mockDebugInstance as unknown as debug.Debugger)

      const debugFn = createDebugger('combined:test', {
        depth: 3,
        onlyWhenFocused: true,
      })

      expect(typeof debugFn).toBe('function')
    })

    it('应该处理错误情况', () => {
      mockDebug.mockImplementation(() => {
        throw new Error('Debug creation failed')
      })

      expect(() => createDebugger('error:test')).toThrow(
        'Debug creation failed',
      )
    })
  })

  describe('类型安全验证', () => {
    it('应该返回正确的函数类型', () => {
      const mockLogFn = jest.fn()
      const mockDebugInstance = Object.assign(mockLogFn, {
        enabled: true,
        namespace: 'test:types',
      })

      mockDebug.mockReturnValue(mockDebugInstance as unknown as debug.Debugger)

      const debugFn = createDebugger('test:types')

      if (debugFn) {
        debugFn('message')
        debugFn('message with data', { user: 'test' })
        debugFn('message with multiple', 'args', 123, true)

        expect(mockLogFn).toHaveBeenCalledTimes(3)
      }
    })

    it('应该处理返回值类型', () => {
      const mockLogFn = jest.fn()

      // 测试enabled情况
      const enabledInstance = Object.assign(mockLogFn, {
        enabled: true,
        namespace: 'test:enabled',
      })
      mockDebug.mockReturnValue(enabledInstance as unknown as debug.Debugger)

      const enabledResult = createDebugger('test:enabled')
      expect(typeof enabledResult).toBe('function')

      // 测试disabled情况
      const disabledInstance = Object.assign(jest.fn(), {
        enabled: false,
        namespace: 'test:disabled',
      })
      mockDebug.mockReturnValue(disabledInstance as unknown as debug.Debugger)

      const disabledResult = createDebugger('test:disabled')
      expect(disabledResult).toBeUndefined()
    })
  })
})
