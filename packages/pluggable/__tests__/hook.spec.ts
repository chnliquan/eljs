/* eslint-disable @typescript-eslint/no-explicit-any */
import type { HookOptions } from '../src'
import { Hook } from '../src'
import { createMockPlugin } from './setup'

describe('Hook', () => {
  let mockPlugin: any
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

  describe('constructor', () => {
    it('should create hook with valid options', () => {
      const hook = new Hook(validOptions)

      expect(hook.plugin).toBe(mockPlugin)
      expect(hook.key).toBe('testHook')
      expect(hook.fn).toBe(validOptions.fn)
      expect(hook.stage).toBe(0)
      expect(hook.before).toBeUndefined()
      expect(hook.constructorOptions).toEqual(validOptions)
    })

    it('should create hook with before option', () => {
      const options = { ...validOptions, before: 'anotherHook' }
      const hook = new Hook(options)

      expect(hook.before).toBe('anotherHook')
    })

    it('should create hook with custom stage', () => {
      const options = { ...validOptions, stage: 100 }
      const hook = new Hook(options)

      expect(hook.stage).toBe(100)
    })

    it('should throw error when key is missing', () => {
      const options = { ...validOptions, key: '' }

      expect(() => new Hook(options)).toThrow(
        'Invalid hook [object Object], `key` and `fn` must be supplied.',
      )
    })

    it('should throw error when fn is missing', () => {
      const options = { ...validOptions, fn: null as any }

      expect(() => new Hook(options)).toThrow(
        'Invalid hook [object Object], `key` and `fn` must be supplied.',
      )
    })

    it('should handle undefined optional properties', () => {
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

  describe('properties', () => {
    it('should expose all required properties', () => {
      const hook = new Hook(validOptions)

      expect(hook).toHaveProperty('plugin')
      expect(hook).toHaveProperty('key')
      expect(hook).toHaveProperty('fn')
      expect(hook).toHaveProperty('stage')
      expect(hook).toHaveProperty('before')
      expect(hook).toHaveProperty('constructorOptions')
    })

    it('should maintain reference to original function', () => {
      const mockFn = jest.fn()
      const options = { ...validOptions, fn: mockFn }
      const hook = new Hook(options)

      expect(hook.fn).toBe(mockFn)
    })
  })
})
