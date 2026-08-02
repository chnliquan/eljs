import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  parsePackageSpecifier,
  type ParsedPackageSpecifier,
} from '../../src/npm'

// 重要：清除模块缓存以避免缓存问题
beforeEach(() => {
  vi.resetModules()
})

describe('NPM 工具函数 - 包名解析', () => {
  describe('parsePackageSpecifier 包名解析功能', () => {
    it('应该解析带版本的作用域包', () => {
      const result: ParsedPackageSpecifier =
        parsePackageSpecifier('@eljs/utils@1.0.0')

      expect(result).toEqual({
        name: '@eljs/utils',
        version: '1.0.0',
        scope: '@eljs',
        unscopedName: 'utils',
      } satisfies ParsedPackageSpecifier)
    })

    it('应该解析带版本的非作用域包', () => {
      const result: ParsedPackageSpecifier =
        parsePackageSpecifier('lodash@4.17.21')

      expect(result).toEqual({
        name: 'lodash',
        version: '4.17.21',
        scope: '',
        unscopedName: 'lodash',
      } satisfies ParsedPackageSpecifier)
    })

    it('应该解析不带版本的作用域包', () => {
      const result: ParsedPackageSpecifier =
        parsePackageSpecifier('@eljs/utils')

      expect(result).toEqual({
        name: '@eljs/utils',
        version: 'latest',
        scope: '@eljs',
        unscopedName: 'utils',
      } satisfies ParsedPackageSpecifier)
    })

    it('应该解析不带版本的非作用域包', () => {
      const result: ParsedPackageSpecifier = parsePackageSpecifier('lodash')

      expect(result).toEqual({
        name: 'lodash',
        version: 'latest',
        scope: '',
        unscopedName: 'lodash',
      } satisfies ParsedPackageSpecifier)
    })

    it('应该处理复杂的版本范围', () => {
      const result: ParsedPackageSpecifier =
        parsePackageSpecifier('react@^18.0.0')

      expect(result).toEqual({
        name: 'react',
        version: '^18.0.0',
        scope: '',
        unscopedName: 'react',
      } satisfies ParsedPackageSpecifier)
    })

    it('应该优雅地处理格式错误的包名', () => {
      const result: ParsedPackageSpecifier = parsePackageSpecifier('@')

      expect(result).toEqual({
        name: '@',
        version: 'latest',
        scope: '',
        unscopedName: '@',
      } satisfies ParsedPackageSpecifier)
    })
  })
})
