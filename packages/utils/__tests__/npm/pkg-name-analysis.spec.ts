import { pkgNameAnalysis, type ResolvedPkgName } from '../../src/npm'

// 重要：清除模块缓存以避免缓存问题
beforeEach(() => {
  jest.resetModules()
})

describe('NPM 工具函数 - 包名解析', () => {
  describe('pkgNameAnalysis 包名解析功能', () => {
    it('应该解析带版本的作用域包', () => {
      const result: ResolvedPkgName = pkgNameAnalysis('@eljs/utils@1.0.0')

      expect(result).toEqual({
        name: '@eljs/utils',
        version: '1.0.0',
        scope: '@eljs',
        unscopedName: 'utils',
      } satisfies ResolvedPkgName)
    })

    it('应该解析带版本的非作用域包', () => {
      const result: ResolvedPkgName = pkgNameAnalysis('lodash@4.17.21')

      expect(result).toEqual({
        name: 'lodash',
        version: '4.17.21',
        scope: '',
        unscopedName: 'lodash',
      } satisfies ResolvedPkgName)
    })

    it('应该解析不带版本的作用域包', () => {
      const result: ResolvedPkgName = pkgNameAnalysis('@eljs/utils')

      expect(result).toEqual({
        name: '@eljs/utils',
        version: 'latest',
        scope: '@eljs',
        unscopedName: 'utils',
      } satisfies ResolvedPkgName)
    })

    it('应该解析不带版本的非作用域包', () => {
      const result: ResolvedPkgName = pkgNameAnalysis('lodash')

      expect(result).toEqual({
        name: 'lodash',
        version: 'latest',
        scope: '',
        unscopedName: 'lodash',
      } satisfies ResolvedPkgName)
    })

    it('应该处理复杂的版本范围', () => {
      const result: ResolvedPkgName = pkgNameAnalysis('react@^18.0.0')

      expect(result).toEqual({
        name: 'react',
        version: '^18.0.0',
        scope: '',
        unscopedName: 'react',
      } satisfies ResolvedPkgName)
    })

    it('应该优雅地处理格式错误的包名', () => {
      const result: ResolvedPkgName = pkgNameAnalysis('@')

      expect(result).toEqual({
        name: '@',
        version: 'latest',
        scope: '',
        unscopedName: '@',
      } satisfies ResolvedPkgName)
    })
  })
})
