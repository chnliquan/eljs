import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
/**
 * @file packages/release internal 模块单元测试
 * @description 测试 internal 目录下的插件系统
 */

import internalPreset from '../../src/internal/index'

const context = {
  plugin: {
    path: fileURLToPath(
      new URL('../../src/internal/index.ts', import.meta.url),
    ),
  },
} as Parameters<typeof internalPreset>[0]

describe('内部预设测试', () => {
  describe('internalPreset 函数', () => {
    it('应该返回包含插件列表的对象', () => {
      const result = internalPreset(context)

      expect(result).toBeDefined()
      expect(result).toHaveProperty('plugins')
      expect(Array.isArray(result.plugins)).toBe(true)
    })

    it('应该包含所有必需的插件', () => {
      const result = internalPreset(context)
      const plugins = result.plugins

      expect(plugins).toHaveLength(5)

      // 验证插件路径是否正确
      expect(plugins.some(plugin => plugin.includes('bootstrap'))).toBe(true)
      expect(plugins.some(plugin => plugin.includes('git'))).toBe(true)
      expect(plugins.some(plugin => plugin.includes('npm'))).toBe(true)
      expect(plugins.some(plugin => plugin.includes('version'))).toBe(true)
      expect(plugins.some(plugin => plugin.includes('github'))).toBe(true)
    })

    it('应该使用 require.resolve 解析插件路径', () => {
      const result = internalPreset(context)

      result.plugins.forEach(plugin => {
        expect(typeof plugin).toBe('string')
        expect(plugin.length).toBeGreaterThan(0)
        // 插件路径应该是绝对路径
        expect(plugin).toMatch(/[/\\]/)
      })
    })

    it('插件应该按照正确的顺序排列', () => {
      const result = internalPreset(context)
      const plugins = result.plugins

      // 验证插件顺序
      expect(plugins[0]).toContain('bootstrap')
      expect(plugins[1]).toContain('git')
      expect(plugins[2]).toContain('npm')
      expect(plugins[3]).toContain('version')
      expect(plugins[4]).toContain('github')
    })

    it('应该是纯函数（无副作用）', () => {
      const result1 = internalPreset(context)
      const result2 = internalPreset(context)

      expect(result1).toEqual(result2)
      expect(result1).not.toBe(result2) // 应该返回新的对象实例
    })

    it('返回的对象应该只包含 plugins 属性', () => {
      const result = internalPreset(context)
      const keys = Object.keys(result)

      expect(keys).toEqual(['plugins'])
    })
  })

  describe('插件路径有效性', () => {
    it('所有插件路径都应该能够被 require 解析', () => {
      const result = internalPreset(context)

      result.plugins.forEach(pluginPath => {
        expect(() => {
          require.resolve(pluginPath)
        }).not.toThrow()
      })
    })

    it('插件文件应该存在', () => {
      const result = internalPreset(context)

      result.plugins.forEach(pluginPath => {
        expect(() => {
          const resolvedPath = require.resolve(pluginPath)
          expect(resolvedPath).toBeTruthy()
        }).not.toThrow()
      })
    })
  })

  describe('预设配置结构', () => {
    it('应该符合 plugin host 预设格式', () => {
      const result = internalPreset(context)

      // 应该有 plugins 数组
      expect(result.plugins).toBeDefined()
      expect(Array.isArray(result.plugins)).toBe(true)

      // 插件应该是字符串路径
      result.plugins.forEach(plugin => {
        expect(typeof plugin).toBe('string')
      })
    })

    it('不应该包含 presets 属性', () => {
      const result = internalPreset(context)

      expect(result).not.toHaveProperty('presets')
    })

    it('不应该包含其他不相关的属性', () => {
      const result = internalPreset(context)
      const allowedKeys = ['plugins', 'presets']

      Object.keys(result).forEach(key => {
        expect(allowedKeys).toContain(key)
      })
    })
  })
})
