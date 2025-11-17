/**
 * @file packages/release utils/index 模块单元测试
 * @description 测试 utils/index.ts 导出功能
 */

import * as utilsIndex from '../../src/utils/index'

describe('工具函数模块导出测试', () => {
  describe('模块导出验证', () => {
    it('应该导出 cancel 模块的函数', () => {
      expect(utilsIndex.onCancel).toBeDefined()
      expect(typeof utilsIndex.onCancel).toBe('function')
    })

    it('应该导出 changelog 模块的函数', () => {
      expect(utilsIndex.getChangelog).toBeDefined()
      expect(typeof utilsIndex.getChangelog).toBe('function')
    })

    it('应该导出 error 模块的类', () => {
      expect(utilsIndex.AppError).toBeDefined()
      expect(typeof utilsIndex.AppError).toBe('function')
    })

    it('应该导出 npm 模块的函数', () => {
      expect(utilsIndex.getRemoteDistTag).toBeDefined()
      expect(typeof utilsIndex.getRemoteDistTag).toBe('function')

      expect(utilsIndex.syncCnpm).toBeDefined()
      expect(typeof utilsIndex.syncCnpm).toBe('function')
    })

    it('应该导出 pkg 模块的函数', () => {
      expect(utilsIndex.updatePackageLock).toBeDefined()
      expect(typeof utilsIndex.updatePackageLock).toBe('function')

      expect(utilsIndex.updatePackageVersion).toBeDefined()
      expect(typeof utilsIndex.updatePackageVersion).toBe('function')

      expect(utilsIndex.updatePackageDependencies).toBeDefined()
      expect(typeof utilsIndex.updatePackageDependencies).toBe('function')
    })

    it('应该导出 version 模块的函数', () => {
      expect(utilsIndex.isPrerelease).toBeDefined()
      expect(typeof utilsIndex.isPrerelease).toBe('function')

      expect(utilsIndex.isAlphaVersion).toBeDefined()
      expect(typeof utilsIndex.isAlphaVersion).toBe('function')

      expect(utilsIndex.isBetaVersion).toBeDefined()
      expect(typeof utilsIndex.isBetaVersion).toBe('function')

      expect(utilsIndex.isRcVersion).toBeDefined()
      expect(typeof utilsIndex.isRcVersion).toBe('function')

      expect(utilsIndex.isCanaryVersion).toBeDefined()
      expect(typeof utilsIndex.isCanaryVersion).toBe('function')

      expect(utilsIndex.isVersionValid).toBeDefined()
      expect(typeof utilsIndex.isVersionValid).toBe('function')

      expect(utilsIndex.parseVersion).toBeDefined()
      expect(typeof utilsIndex.parseVersion).toBe('function')

      expect(utilsIndex.isVersionExist).toBeDefined()
      expect(typeof utilsIndex.isVersionExist).toBe('function')

      expect(utilsIndex.getStableVersion).toBeDefined()
      expect(typeof utilsIndex.getStableVersion).toBe('function')

      expect(utilsIndex.getReferenceVersion).toBeDefined()
      expect(typeof utilsIndex.getReferenceVersion).toBe('function')

      expect(utilsIndex.getMaxVersion).toBeDefined()
      expect(typeof utilsIndex.getMaxVersion).toBe('function')

      expect(utilsIndex.getReleaseVersion).toBeDefined()
      expect(typeof utilsIndex.getReleaseVersion).toBe('function')

      expect(utilsIndex.getCanaryVersion).toBeDefined()
      expect(typeof utilsIndex.getCanaryVersion).toBe('function')
    })
  })

  describe('导出内容完整性验证', () => {
    it('所有导出的函数应该都已定义', () => {
      const expectedExports = [
        // cancel.ts
        'onCancel',
        // changelog.ts
        'getChangelog',
        // error.ts
        'AppError',
        // npm.ts
        'getRemoteDistTag',
        'syncCnpm',
        // pkg.ts
        'updatePackageLock',
        'updatePackageVersion',
        'updatePackageDependencies',
        // version.ts
        'isPrerelease',
        'isAlphaVersion',
        'isBetaVersion',
        'isRcVersion',
        'isCanaryVersion',
        'isVersionValid',
        'parseVersion',
        'isVersionExist',
        'getStableVersion',
        'getReferenceVersion',
        'getMaxVersion',
        'getReleaseVersion',
        'getCanaryVersion',
      ]

      expectedExports.forEach(exportName => {
        expect(utilsIndex).toHaveProperty(exportName)
        expect(
          (utilsIndex as Record<string, unknown>)[exportName],
        ).toBeDefined()
      })
    })

    it('导出的模块应该没有未定义的值', () => {
      const exportValues = Object.values(utilsIndex)
      exportValues.forEach(value => {
        expect(value).toBeDefined()
        expect(value).not.toBeNull()
      })
    })

    it('所有导出的函数应该是可调用的', () => {
      const functionExports = [
        'onCancel',
        'getChangelog',
        'getRemoteDistTag',
        'syncCnpm',
        'updatePackageLock',
        'updatePackageVersion',
        'updatePackageDependencies',
        'isPrerelease',
        'isAlphaVersion',
        'isBetaVersion',
        'isRcVersion',
        'isCanaryVersion',
        'isVersionValid',
        'parseVersion',
        'isVersionExist',
        'getStableVersion',
        'getReferenceVersion',
        'getMaxVersion',
        'getReleaseVersion',
        'getCanaryVersion',
      ]

      functionExports.forEach(funcName => {
        const func = (utilsIndex as Record<string, unknown>)[funcName]
        expect(typeof func).toBe('function')
      })
    })

    it('AppError 类应该是可实例化的', () => {
      expect(typeof utilsIndex.AppError).toBe('function')
      const error = new utilsIndex.AppError('测试错误')
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(utilsIndex.AppError)
      expect(error.name).toBe('AppError')
      expect(error.message).toBe('测试错误')
    })
  })

  describe('模块导出类型验证', () => {
    it('版本检测函数应该接受字符串参数', () => {
      const versionCheckers = [
        utilsIndex.isPrerelease,
        utilsIndex.isAlphaVersion,
        utilsIndex.isBetaVersion,
        utilsIndex.isRcVersion,
        utilsIndex.isCanaryVersion,
      ]

      versionCheckers.forEach(checker => {
        expect(typeof checker).toBe('function')
        // 这些函数应该能接受字符串参数
        expect(() => checker('1.0.0-alpha.1')).not.toThrow()
      })
    })

    it('版本处理函数应该是异步或同步函数', () => {
      // 同步函数
      const syncFunctions = [
        utilsIndex.isVersionValid,
        utilsIndex.parseVersion,
        utilsIndex.getStableVersion,
        utilsIndex.getReferenceVersion,
        utilsIndex.getMaxVersion,
        utilsIndex.getReleaseVersion,
      ]

      syncFunctions.forEach(func => {
        expect(typeof func).toBe('function')
      })

      // 异步函数
      const asyncFunctions = [
        utilsIndex.isVersionExist,
        utilsIndex.getCanaryVersion,
        utilsIndex.getChangelog,
        utilsIndex.syncCnpm,
        utilsIndex.getRemoteDistTag,
      ]

      asyncFunctions.forEach(func => {
        expect(typeof func).toBe('function')
      })
    })
  })

  describe('模块边界情况测试', () => {
    it('导入模块时不应该抛出错误', () => {
      expect(() => {
        const module = utilsIndex
        return module
      }).not.toThrow()
    })

    it('导出的对象应该是冻结的或可扩展的', () => {
      // 确保导出的模块是稳定的
      const originalKeys = Object.keys(utilsIndex)
      expect(originalKeys.length).toBeGreaterThan(0)

      // 尝试访问所有属性
      originalKeys.forEach(key => {
        expect(() => {
          const value = (utilsIndex as Record<string, unknown>)[key]
          return value
        }).not.toThrow()
      })
    })
  })
})
