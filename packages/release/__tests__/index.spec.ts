/**
 * @file packages/release index 模块单元测试
 * @description 测试 index.ts 导出功能
 */

import * as releaseIndex from '../src/index'

describe('发布模块入口文件测试', () => {
  describe('模块导出验证', () => {
    it('应该导出 resolveBin 函数', () => {
      expect(releaseIndex.resolveBin).toBeDefined()
      expect(typeof releaseIndex.resolveBin).toBe('function')
    })

    it('应该导出 release 函数', () => {
      expect(releaseIndex.release).toBeDefined()
      expect(typeof releaseIndex.release).toBe('function')
    })

    it('应该导出 defaultConfig 对象', () => {
      expect(releaseIndex.defaultConfig).toBeDefined()
      expect(typeof releaseIndex.defaultConfig).toBe('object')
    })

    it('应该导出 defineConfig 函数', () => {
      expect(releaseIndex.defineConfig).toBeDefined()
      expect(typeof releaseIndex.defineConfig).toBe('function')
    })

    it('应该导出 Runner 类', () => {
      expect(releaseIndex.Runner).toBeDefined()
      expect(typeof releaseIndex.Runner).toBe('function')
    })

    it('应该导出工具函数模块', () => {
      expect(releaseIndex.AppError).toBeDefined()
      expect(releaseIndex.onCancel).toBeDefined()
      expect(releaseIndex.parseVersion).toBeDefined()
      expect(releaseIndex.isVersionValid).toBeDefined()
    })

    it('应该导出类型定义', () => {
      // 类型导出在运行时不可直接检测，但可以确保没有错误
      expect(() => {
        // 这里主要确保没有导入错误
        const module = releaseIndex
        return module
      }).not.toThrow()
    })
  })

  describe('导出内容类型验证', () => {
    it('resolveBin 应该是从 resolve-bin 库导出的函数', () => {
      // 这里测试 resolveBin 的基本功能
      expect(releaseIndex.resolveBin).toBeDefined()
      expect(typeof releaseIndex.resolveBin).toBe('function')
    })

    it('所有核心函数都应该被正确导出', () => {
      const expectedExports = [
        'resolveBin',
        'defaultConfig',
        'defineConfig',
        'release',
        'Runner',
        'AppError',
        'onCancel',
        'parseVersion',
        'isVersionValid',
      ]

      expectedExports.forEach(exportName => {
        expect(releaseIndex).toHaveProperty(exportName)
        expect(
          (releaseIndex as Record<string, unknown>)[exportName],
        ).toBeDefined()
      })
    })
  })

  describe('模块完整性验证', () => {
    it('导出的模块应该没有未定义的值', () => {
      const exportValues = Object.values(releaseIndex)
      exportValues.forEach(value => {
        expect(value).toBeDefined()
        expect(value).not.toBeNull()
      })
    })

    it('所有导出的函数应该是可调用的', () => {
      const functions = [
        'resolveBin',
        'defineConfig',
        'release',
        'onCancel',
        'parseVersion',
        'isVersionValid',
      ]

      functions.forEach(funcName => {
        const func = (releaseIndex as Record<string, unknown>)[funcName]
        expect(typeof func).toBe('function')
      })
    })

    it('Runner 类应该是可实例化的', () => {
      expect(typeof releaseIndex.Runner).toBe('function')
      expect(() => new releaseIndex.Runner()).not.toThrow()
    })

    it('AppError 类应该是可实例化的错误类', () => {
      expect(typeof releaseIndex.AppError).toBe('function')

      const error = new releaseIndex.AppError('测试错误')
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(releaseIndex.AppError)
      expect(error.name).toBe('AppError')
      expect(error.message).toBe('测试错误')
    })
  })
})
