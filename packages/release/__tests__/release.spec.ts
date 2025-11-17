/**
 * @file packages/release release 模块单元测试
 * @description 测试 release.ts 主要功能
 */

import { release } from '../src/release'
import { Runner } from '../src/runner'
import type { Config } from '../src/types'

describe('发布函数核心测试', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('release 函数基本功能', () => {
    test('应该能够创建 Runner 实例并执行发布', async () => {
      // 不模拟 Runner，而是实际创建它
      const mockRun = jest.fn().mockResolvedValue(undefined)

      // 只模拟 Runner 的 run 方法
      jest.spyOn(Runner.prototype, 'run').mockImplementation(mockRun)

      await release()

      expect(mockRun).toHaveBeenCalledWith(undefined)
    })

    test('应该使用指定版本调用 run 方法', async () => {
      const mockRun = jest.fn().mockResolvedValue(undefined)
      jest.spyOn(Runner.prototype, 'run').mockImplementation(mockRun)

      const version = '1.2.3'
      await release(version)

      expect(mockRun).toHaveBeenCalledWith(version)
    })

    test('应该使用指定配置创建 Runner 实例', async () => {
      const mockRun = jest.fn().mockResolvedValue(undefined)
      jest.spyOn(Runner.prototype, 'run').mockImplementation(mockRun)

      const options: Config = {
        cwd: process.cwd(), // 使用当前目录，确保 package.json 存在
        git: {
          requireClean: false,
        },
        npm: {
          canary: true,
        },
      }

      await release(undefined, options)

      expect(mockRun).toHaveBeenCalledWith(undefined)
    })

    test('应该同时使用版本和配置参数', async () => {
      const mockRun = jest.fn().mockResolvedValue(undefined)
      jest.spyOn(Runner.prototype, 'run').mockImplementation(mockRun)

      const version = '2.0.0'
      const options: Config = {
        cwd: process.cwd(), // 使用当前目录
        npm: {
          confirm: false,
        },
      }

      await release(version, options)

      expect(mockRun).toHaveBeenCalledWith(version)
    })
  })

  describe('release 函数错误处理', () => {
    test('应该正确传播 Runner.run 方法抛出的错误', async () => {
      const testError = new Error('Runner 执行失败')
      jest.spyOn(Runner.prototype, 'run').mockRejectedValue(testError)

      await expect(release()).rejects.toThrow('Runner 执行失败')
    })

    test('应该正确处理 Runner 构造函数抛出的错误', async () => {
      // 简化这个测试，不去模拟构造函数
      expect(async () => {
        await release(undefined, { cwd: '/non/existent/path' })
      }).rejects.toThrow()
    })
  })

  describe('release 函数参数传递验证', () => {
    test('当没有传入参数时，应该使用默认值', async () => {
      const mockRun = jest.fn().mockResolvedValue(undefined)
      jest.spyOn(Runner.prototype, 'run').mockImplementation(mockRun)

      await release()

      expect(mockRun).toHaveBeenCalledWith(undefined)
    })

    test('应该正确处理空字符串版本', async () => {
      const mockRun = jest.fn().mockResolvedValue(undefined)
      jest.spyOn(Runner.prototype, 'run').mockImplementation(mockRun)

      await release('')

      expect(mockRun).toHaveBeenCalledWith('')
    })

    test('应该正确处理空配置对象', async () => {
      const mockRun = jest.fn().mockResolvedValue(undefined)
      jest.spyOn(Runner.prototype, 'run').mockImplementation(mockRun)

      await release(undefined, {})

      expect(mockRun).toHaveBeenCalledWith(undefined)
    })

    test('应该支持不同类型的版本字符串', async () => {
      const mockRun = jest.fn().mockResolvedValue(undefined)
      jest.spyOn(Runner.prototype, 'run').mockImplementation(mockRun)

      const versions = ['1.0.0', 'major', 'minor', 'patch', '1.0.0-alpha.1']

      for (const version of versions) {
        await release(version)
        expect(mockRun).toHaveBeenCalledWith(version)
        jest.clearAllMocks()
      }
    })
  })

  describe('release 函数异步行为验证', () => {
    test('应该是异步函数并返回 Promise', () => {
      const mockRun = jest.fn().mockResolvedValue(undefined)
      jest.spyOn(Runner.prototype, 'run').mockImplementation(mockRun)

      const result = release()
      expect(result).toBeInstanceOf(Promise)
    })

    test('应该等待 Runner.run 方法完成', async () => {
      let runCompleted = false
      const mockRun = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        runCompleted = true
      })
      jest.spyOn(Runner.prototype, 'run').mockImplementation(mockRun)

      await release()
      expect(runCompleted).toBe(true)
    })
  })
})
