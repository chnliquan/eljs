import type { HookOptions } from '../src'
import { Hook } from '../src'
import type { Plugin } from '../src/plugin'
import { createMockPlugin } from './setup'

describe('钩子', () => {
  let mockPlugin: Plugin
  let validOptions: HookOptions

  beforeEach(() => {
    mockPlugin = createMockPlugin('test-plugin')
    validOptions = {
      plugin: mockPlugin,
      key: 'testHook',
      fn: jest.fn(),
      stage: 0,
      before: undefined,
    }
  })

  describe('构造函数', () => {
    it('应该创建带有有效选项的钩子', () => {
      const hook = new Hook(validOptions)

      expect(hook.plugin).toBe(mockPlugin)
      expect(hook.key).toBe('testHook')
      expect(hook.fn).toBe(validOptions.fn)
      expect(hook.stage).toBe(0)
      expect(hook.before).toBeUndefined()
      expect(hook.constructorOptions).toEqual(validOptions)
    })

    it('应该创建带有before选项的钩子', () => {
      const options = { ...validOptions, before: 'anotherHook' }
      const hook = new Hook(options)

      expect(hook.before).toBe('anotherHook')
    })

    it('应该创建带有自定义阶段的钩子', () => {
      const options = { ...validOptions, stage: 100 }
      const hook = new Hook(options)

      expect(hook.stage).toBe(100)
    })

    it('应该在缺少key时抛出错误', () => {
      const options = { ...validOptions, key: '' }

      expect(() => new Hook(options)).toThrow(
        'Invalid hook [object Object], `key` and `fn` must be supplied.',
      )
    })

    it('应该在缺少fn时抛出错误', () => {
      const options = {
        ...validOptions,
        fn: null as unknown as HookOptions['fn'],
      }

      expect(() => new Hook(options)).toThrow(
        'Invalid hook [object Object], `key` and `fn` must be supplied.',
      )
    })

    it('应该处理未定义的可选属性', () => {
      const options = {
        plugin: mockPlugin,
        key: 'testHook',
        fn: jest.fn(),
        stage: undefined,
        before: undefined,
      }
      const hook = new Hook(options)

      expect(hook.stage).toBeUndefined()
      expect(hook.before).toBeUndefined()
    })
  })

  describe('属性', () => {
    it('应该暴露所有必需的属性', () => {
      const hook = new Hook(validOptions)

      expect(hook).toHaveProperty('plugin')
      expect(hook).toHaveProperty('key')
      expect(hook).toHaveProperty('fn')
      expect(hook).toHaveProperty('stage')
      expect(hook).toHaveProperty('before')
      expect(hook).toHaveProperty('constructorOptions')
    })

    it('应该保持对原始函数的引用', () => {
      const mockFn = jest.fn()
      const options = { ...validOptions, fn: mockFn }
      const hook = new Hook(options)

      expect(hook.fn).toBe(mockFn)
    })
  })
})
