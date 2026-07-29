import { describe, expect, it } from 'vitest'
/**
 * @file packages/release utils/error 模块单元测试
 * @description 测试 AppError 错误类功能
 */

import { AppError } from '../../src/utils/error'

describe('应用错误类测试', () => {
  describe('AppError 构造函数', () => {
    it('应该能够创建 AppError 实例', () => {
      const message = '这是一个测试错误'
      const error = new AppError(message)

      expect(error).toBeInstanceOf(AppError)
      expect(error).toBeInstanceOf(Error)
    })

    it('应该正确设置错误消息', () => {
      const message = '自定义错误消息'
      const error = new AppError(message)

      expect(error.message).toBe(message)
    })

    it('应该正确设置错误名称', () => {
      const error = new AppError('测试消息')
      expect(error.name).toBe('AppError')
    })
  })

  describe('AppError 错误信息处理', () => {
    it('应该支持空字符串消息', () => {
      const error = new AppError('')
      expect(error.message).toBe('')
      expect(error.name).toBe('AppError')
    })

    it('应该支持多行错误消息', () => {
      const message = '第一行错误\n第二行错误\n第三行错误'
      const error = new AppError(message)
      expect(error.message).toBe(message)
    })

    it('应该支持包含特殊字符的错误消息', () => {
      const message = '错误: 文件 "it.js" 不存在 (代码: 404)'
      const error = new AppError(message)
      expect(error.message).toBe(message)
    })

    it('应该支持 Unicode 字符', () => {
      const message = '错误: 文件包含非法字符 ✗ 处理失败 🚫'
      const error = new AppError(message)
      expect(error.message).toBe(message)
    })
  })

  describe('AppError 继承行为', () => {
    it('应该继承自 Error 类', () => {
      const error = new AppError('测试')
      expect(error instanceof Error).toBe(true)
      expect(error instanceof AppError).toBe(true)
    })

    it('应该具有 stack 属性', () => {
      const error = new AppError('测试')
      expect(error.stack).toBeDefined()
      expect(typeof error.stack).toBe('string')
    })

    it('应该能够被 try-catch 捕获', () => {
      expect(() => {
        throw new AppError('测试错误')
      }).toThrow('测试错误')

      expect(() => {
        throw new AppError('测试错误')
      }).toThrow(AppError)
    })
  })

  describe('AppError 实例方法', () => {
    it('toString() 方法应该返回正确格式', () => {
      const error = new AppError('测试错误')
      const result = error.toString()
      expect(result).toBe('AppError: 测试错误')
    })

    it('应该支持 Error 的所有标准属性', () => {
      const error = new AppError('测试错误')

      expect(error).toHaveProperty('name')
      expect(error).toHaveProperty('message')
      expect(error).toHaveProperty('stack')
    })
  })

  describe('AppError 类型检查', () => {
    it('应该能够通过 instanceof 检查类型', () => {
      const appError = new AppError('应用错误')
      const standardError = new Error('标准错误')

      expect(appError instanceof AppError).toBe(true)
      expect(appError instanceof Error).toBe(true)
      expect(standardError instanceof AppError).toBe(false)
      expect(standardError instanceof Error).toBe(true)
    })

    it('应该能够通过 name 属性识别错误类型', () => {
      const appError = new AppError('测试')
      const standardError = new Error('测试')

      expect(appError.name).toBe('AppError')
      expect(standardError.name).toBe('Error')
    })
  })

  describe('AppError 错误传播', () => {
    it('应该能够作为 Promise rejection 使用', async () => {
      const itError = new AppError('异步错误')

      await expect(Promise.reject(itError)).rejects.toThrow('异步错误')
      await expect(Promise.reject(itError)).rejects.toBeInstanceOf(AppError)
    })

    it('应该能够重新抛出时保持错误类型', () => {
      const originalError = new AppError('原始错误')

      expect(() => {
        throw originalError
      }).toThrow(AppError)
    })
  })

  describe('AppError 边界情况', () => {
    it('应该支持非常长的错误消息', () => {
      const longMessage = 'x'.repeat(10000)
      const error = new AppError(longMessage)
      expect(error.message).toBe(longMessage)
      expect(error.message.length).toBe(10000)
    })

    it('消息参数类型应该严格为字符串', () => {
      // TypeScript 应该确保只能传入字符串
      const error = new AppError('有效消息')
      expect(typeof error.message).toBe('string')
    })
  })
})
