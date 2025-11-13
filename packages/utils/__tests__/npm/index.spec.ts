import * as npmModule from '../../src/npm'

describe('NPM 工具函数', () => {
  describe('pkgNameAnalysis 包名解析', () => {
    it('应该正确解析包名', () => {
      expect(npmModule.pkgNameAnalysis('@eljs/utils@1.0.0')).toEqual({
        name: '@eljs/utils',
        version: '1.0.0',
        scope: '@eljs',
        unscopedName: 'utils',
      })

      expect(npmModule.pkgNameAnalysis('lodash@4.17.21')).toEqual({
        name: 'lodash',
        version: '4.17.21',
        scope: '',
        unscopedName: 'lodash',
      })

      expect(npmModule.pkgNameAnalysis('@eljs/utils')).toEqual({
        name: '@eljs/utils',
        version: 'latest',
        scope: '@eljs',
        unscopedName: 'utils',
      })

      expect(npmModule.pkgNameAnalysis('lodash')).toEqual({
        name: 'lodash',
        version: 'latest',
        scope: '',
        unscopedName: 'lodash',
      })

      expect(npmModule.pkgNameAnalysis('react@^18.0.0')).toEqual({
        name: 'react',
        version: '^18.0.0',
        scope: '',
        unscopedName: 'react',
      })

      expect(npmModule.pkgNameAnalysis('@')).toEqual({
        name: '@',
        version: 'latest',
        scope: '',
        unscopedName: '@',
      })
    })
  })

  describe('模块导出', () => {
    it('应该导出预期的函数', () => {
      expect(typeof npmModule.getPackageManager).toBe('function')
      expect(typeof npmModule.pkgNameAnalysis).toBe('function')
      expect(typeof npmModule.getNpmRegistry).toBe('function')
      expect(typeof npmModule.downloadNpmTarball).toBe('function')
    })
  })
})
