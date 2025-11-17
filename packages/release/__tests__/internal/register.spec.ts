/**
 * @file packages/release internal/register 模块单元测试
 * @description 测试 register.ts 方法注册功能
 */

import registerPlugin from '../../src/internal/register'
import type { Api } from '../../src/types'

// 为测试创建具有必要属性的 API mock
interface TestApi extends Partial<Api> {
  registerMethod: jest.MockedFunction<(name: string) => void>
}

describe('方法注册插件测试', () => {
  let mockApi: TestApi

  beforeEach(() => {
    mockApi = {
      registerMethod: jest.fn(),
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('registerPlugin 函数', () => {
    test('应该注册所有必需的方法', () => {
      registerPlugin(mockApi as unknown as Api)

      const expectedMethods = [
        'modifyConfig',
        'modifyAppData',
        'onCheck',
        'onStart',
        'getIncrementVersion',
        'onBeforeBumpVersion',
        'onBumpVersion',
        'onAfterBumpVersion',
        'getChangelog',
        'onBeforeRelease',
        'onRelease',
        'onAfterRelease',
      ]

      expect(mockApi.registerMethod).toHaveBeenCalledTimes(
        expectedMethods.length,
      )

      expectedMethods.forEach(methodName => {
        expect(mockApi.registerMethod).toHaveBeenCalledWith(methodName)
      })
    })

    test('应该按照正确的顺序注册方法', () => {
      registerPlugin(mockApi as unknown as Api)

      const calls = mockApi.registerMethod.mock.calls
      const registeredMethods = calls.map(call => call[0])

      const expectedOrder = [
        'modifyConfig',
        'modifyAppData',
        'onCheck',
        'onStart',
        'getIncrementVersion',
        'onBeforeBumpVersion',
        'onBumpVersion',
        'onAfterBumpVersion',
        'getChangelog',
        'onBeforeRelease',
        'onRelease',
        'onAfterRelease',
      ]

      expect(registeredMethods).toEqual(expectedOrder)
    })

    test('应该只调用 registerMethod', () => {
      const apiMethods = Object.keys(mockApi)

      registerPlugin(mockApi as unknown as Api)

      // 只应该调用 registerMethod
      expect(mockApi.registerMethod).toHaveBeenCalled()

      // 确保没有调用其他方法（如果 mockApi 有其他方法的话）
      apiMethods.forEach(method => {
        if (
          method !== 'registerMethod' &&
          typeof mockApi[method as keyof TestApi] === 'function'
        ) {
          const methodMock = mockApi[
            method as keyof TestApi
          ] as unknown as jest.MockedFunction<() => void>
          expect(methodMock).not.toHaveBeenCalled()
        }
      })
    })

    test('应该是幂等的（可以多次调用）', () => {
      registerPlugin(mockApi as unknown as Api)
      const firstCallCount = mockApi.registerMethod.mock.calls.length

      jest.clearAllMocks()

      registerPlugin(mockApi as unknown as Api)
      const secondCallCount = mockApi.registerMethod.mock.calls.length

      expect(firstCallCount).toBe(secondCallCount)
    })
  })

  describe('注册的方法验证', () => {
    test('所有注册的方法都应该是有效的标识符', () => {
      registerPlugin(mockApi as unknown as Api)

      const registeredMethods = mockApi.registerMethod.mock.calls.map(
        call => call[0],
      )

      registeredMethods.forEach(methodName => {
        expect(typeof methodName).toBe('string')
        expect(methodName.length).toBeGreaterThan(0)
        // 验证是有效的 JavaScript 标识符
        expect(methodName).toMatch(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/)
      })
    })

    test('注册的方法应该涵盖完整的生命周期', () => {
      registerPlugin(mockApi as unknown as Api)

      const registeredMethods = mockApi.registerMethod.mock.calls.map(
        call => call[0],
      )

      // 配置相关方法
      expect(registeredMethods).toContain('modifyConfig')
      expect(registeredMethods).toContain('modifyAppData')

      // 检查和启动方法
      expect(registeredMethods).toContain('onCheck')
      expect(registeredMethods).toContain('onStart')

      // 版本相关方法
      expect(registeredMethods).toContain('getIncrementVersion')
      expect(registeredMethods).toContain('onBeforeBumpVersion')
      expect(registeredMethods).toContain('onBumpVersion')
      expect(registeredMethods).toContain('onAfterBumpVersion')

      // 发布相关方法
      expect(registeredMethods).toContain('getChangelog')
      expect(registeredMethods).toContain('onBeforeRelease')
      expect(registeredMethods).toContain('onRelease')
      expect(registeredMethods).toContain('onAfterRelease')
    })

    test('应该注册配置修改方法', () => {
      registerPlugin(mockApi as unknown as Api)

      expect(mockApi.registerMethod).toHaveBeenCalledWith('modifyConfig')
      expect(mockApi.registerMethod).toHaveBeenCalledWith('modifyAppData')
    })

    test('应该注册事件钩子方法', () => {
      registerPlugin(mockApi as unknown as Api)

      const eventHooks = [
        'onCheck',
        'onStart',
        'onBeforeBumpVersion',
        'onBumpVersion',
        'onAfterBumpVersion',
        'onBeforeRelease',
        'onRelease',
        'onAfterRelease',
      ]

      eventHooks.forEach(hook => {
        expect(mockApi.registerMethod).toHaveBeenCalledWith(hook)
      })
    })

    test('应该注册数据获取方法', () => {
      registerPlugin(mockApi as unknown as Api)

      expect(mockApi.registerMethod).toHaveBeenCalledWith('getIncrementVersion')
      expect(mockApi.registerMethod).toHaveBeenCalledWith('getChangelog')
    })
  })

  describe('错误处理', () => {
    test('应该处理 API 为空的情况', () => {
      expect(() => {
        registerPlugin(null as unknown as Api)
      }).toThrow()
    })

    test('应该处理 API 没有 registerMethod 方法的情况', () => {
      const incompleteApi = {} as Api

      expect(() => {
        registerPlugin(incompleteApi)
      }).toThrow()
    })

    test('应该处理 registerMethod 抛出错误的情况', () => {
      mockApi.registerMethod.mockImplementation(() => {
        throw new Error('注册失败')
      })

      expect(() => {
        registerPlugin(mockApi as unknown as Api)
      }).toThrow('注册失败')
    })
  })

  describe('插件导出验证', () => {
    test('应该是一个函数', () => {
      expect(typeof registerPlugin).toBe('function')
    })

    test('应该接受 API 参数', () => {
      expect(registerPlugin.length).toBe(1)
    })

    test('应该没有返回值', () => {
      const result = registerPlugin(mockApi as unknown as Api)
      expect(result).toBeUndefined()
    })
  })

  describe('方法注册完整性', () => {
    test('应该覆盖发布流程的所有阶段', () => {
      registerPlugin(mockApi as unknown as Api)

      const registeredMethods = mockApi.registerMethod.mock.calls.map(
        call => call[0],
      )

      // 准备阶段
      expect(registeredMethods).toContain('modifyConfig')
      expect(registeredMethods).toContain('modifyAppData')

      // 检查阶段
      expect(registeredMethods).toContain('onCheck')

      // 启动阶段
      expect(registeredMethods).toContain('onStart')

      // 版本处理阶段
      expect(registeredMethods).toContain('getIncrementVersion')
      expect(registeredMethods).toContain('onBeforeBumpVersion')
      expect(registeredMethods).toContain('onBumpVersion')
      expect(registeredMethods).toContain('onAfterBumpVersion')

      // 发布阶段
      expect(registeredMethods).toContain('getChangelog')
      expect(registeredMethods).toContain('onBeforeRelease')
      expect(registeredMethods).toContain('onRelease')
      expect(registeredMethods).toContain('onAfterRelease')
    })

    test('不应该注册重复的方法', () => {
      registerPlugin(mockApi as unknown as Api)

      const registeredMethods = mockApi.registerMethod.mock.calls.map(
        call => call[0],
      )
      const uniqueMethods = [...new Set(registeredMethods)]

      expect(registeredMethods).toEqual(uniqueMethods)
    })

    test('注册的方法数量应该是确定的', () => {
      registerPlugin(mockApi as unknown as Api)

      // 当前应该注册 12 个方法
      expect(mockApi.registerMethod).toHaveBeenCalledTimes(12)
    })
  })
})
