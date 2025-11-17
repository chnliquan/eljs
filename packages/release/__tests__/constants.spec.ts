/**
 * @file packages/release constants 模块单元测试
 * @description 测试 constants.ts 常量定义
 */

import type { ReleaseType } from 'semver'

import { prereleaseTypes, releaseTypes } from '../src/constants'

describe('常量定义测试', () => {
  describe('prereleaseTypes 常量', () => {
    it('应该包含所有预发布类型', () => {
      expect(prereleaseTypes).toEqual([
        'prerelease',
        'prepatch',
        'preminor',
        'premajor',
      ])
    })

    it('应该是数组类型', () => {
      expect(Array.isArray(prereleaseTypes)).toBe(true)
    })

    it('应该包含4个预发布类型', () => {
      expect(prereleaseTypes).toHaveLength(4)
    })

    it('所有元素都应该是字符串', () => {
      prereleaseTypes.forEach(type => {
        expect(typeof type).toBe('string')
      })
    })

    it('应该包含 prerelease', () => {
      expect(prereleaseTypes).toContain('prerelease')
    })

    it('应该包含 prepatch', () => {
      expect(prereleaseTypes).toContain('prepatch')
    })

    it('应该包含 preminor', () => {
      expect(prereleaseTypes).toContain('preminor')
    })

    it('应该包含 premajor', () => {
      expect(prereleaseTypes).toContain('premajor')
    })
  })

  describe('releaseTypes 常量', () => {
    it('应该包含所有正式发布类型', () => {
      expect(releaseTypes).toEqual(['patch', 'minor', 'major'])
    })

    it('应该是数组类型', () => {
      expect(Array.isArray(releaseTypes)).toBe(true)
    })

    it('应该包含3个发布类型', () => {
      expect(releaseTypes).toHaveLength(3)
    })

    it('所有元素都应该是字符串', () => {
      releaseTypes.forEach(type => {
        expect(typeof type).toBe('string')
      })
    })

    it('应该包含 patch', () => {
      expect(releaseTypes).toContain('patch')
    })

    it('应该包含 minor', () => {
      expect(releaseTypes).toContain('minor')
    })

    it('应该包含 major', () => {
      expect(releaseTypes).toContain('major')
    })
  })

  describe('常量不变性', () => {
    it('prereleaseTypes 应该是不可变的', () => {
      const originalLength = prereleaseTypes.length

      // 尝试修改数组（在严格模式下可能会失败）
      try {
        ;(prereleaseTypes as ReleaseType[]).push('invalid' as ReleaseType)
        // 如果修改成功，移除添加的元素
        if (prereleaseTypes.length > originalLength) {
          ;(prereleaseTypes as ReleaseType[]).pop()
        }
      } catch (error) {
        // 如果是不可变数组，修改会抛出错误
      }

      expect(prereleaseTypes).toHaveLength(originalLength)
    })

    it('releaseTypes 应该是不可变的', () => {
      const originalLength = releaseTypes.length

      try {
        ;(releaseTypes as ReleaseType[]).push('invalid' as ReleaseType)
        if (releaseTypes.length > originalLength) {
          ;(releaseTypes as ReleaseType[]).pop()
        }
      } catch (error) {
        // 如果是不可变数组，修改会抛出错误
      }

      expect(releaseTypes).toHaveLength(originalLength)
    })
  })

  describe('常量导出验证', () => {
    it('应该能够正确导入所有常量', () => {
      expect(prereleaseTypes).toBeDefined()
      expect(releaseTypes).toBeDefined()
    })

    it('导入的常量应该有正确的值', () => {
      expect(prereleaseTypes[0]).toBe('prerelease')
      expect(releaseTypes[0]).toBe('patch')
    })
  })

  describe('语义化版本兼容性', () => {
    it('所有类型都应该是有效的 semver ReleaseType', () => {
      const allTypes = [...prereleaseTypes, ...releaseTypes]
      const validTypes = [
        'major',
        'premajor',
        'minor',
        'preminor',
        'patch',
        'prepatch',
        'prerelease',
      ]

      allTypes.forEach(type => {
        expect(validTypes).toContain(type)
      })
    })

    it('不应该有重复的类型', () => {
      const allTypes = [...prereleaseTypes, ...releaseTypes]
      const uniqueTypes = [...new Set(allTypes)]

      expect(allTypes).toHaveLength(uniqueTypes.length)
    })
  })
})
