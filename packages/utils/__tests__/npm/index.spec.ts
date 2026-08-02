import { describe, expect, it } from 'vitest'
import * as npmModule from '../../src/npm'

describe('NPM 工具函数', () => {
  describe('parsePackageSpecifier 包名解析', () => {
    it('新名称应该解析包标识', () => {
      expect(npmModule.parsePackageSpecifier('@eljs/utils@next')).toEqual({
        name: '@eljs/utils',
        version: 'next',
        scope: '@eljs',
        unscopedName: 'utils',
      })
    })

    it('应该正确解析包名', () => {
      expect(npmModule.parsePackageSpecifier('@eljs/utils@1.0.0')).toEqual({
        name: '@eljs/utils',
        version: '1.0.0',
        scope: '@eljs',
        unscopedName: 'utils',
      })

      expect(npmModule.parsePackageSpecifier('lodash@4.17.21')).toEqual({
        name: 'lodash',
        version: '4.17.21',
        scope: '',
        unscopedName: 'lodash',
      })

      expect(npmModule.parsePackageSpecifier('@eljs/utils')).toEqual({
        name: '@eljs/utils',
        version: 'latest',
        scope: '@eljs',
        unscopedName: 'utils',
      })

      expect(npmModule.parsePackageSpecifier('lodash')).toEqual({
        name: 'lodash',
        version: 'latest',
        scope: '',
        unscopedName: 'lodash',
      })

      expect(npmModule.parsePackageSpecifier('react@^18.0.0')).toEqual({
        name: 'react',
        version: '^18.0.0',
        scope: '',
        unscopedName: 'react',
      })

      expect(npmModule.parsePackageSpecifier('@')).toEqual({
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
      expect(typeof npmModule.parsePackageSpecifier).toBe('function')
      expect(typeof npmModule.getNpmRegistry).toBe('function')
      expect(typeof npmModule.downloadNpmTarball).toBe('function')
    })
  })
})
