/**
 * @file packages/release internal 模块单元测试
 * @description 测试 internal 目录下的插件系统
 */

import internalPreset from '../../src/internal/index'

describe('内部预设测试', () => {
  describe('internalPreset 函数', () => {
    test('应该返回包含插件列表的对象', () => {
      const result = internalPreset()

      expect(result).toBeDefined()
      expect(result).toHaveProperty('plugins')
      expect(Array.isArray(result.plugins)).toBe(true)
    })

    test('应该包含所有必需的插件', () => {
      const result = internalPreset()
      const plugins = result.plugins

      expect(plugins).toHaveLength(6)

      // 验证插件路径是否正确
      expect(plugins.some(plugin => plugin.includes('register'))).toBe(true)
      expect(plugins.some(plugin => plugin.includes('bootstrap'))).toBe(true)
      expect(plugins.some(plugin => plugin.includes('git'))).toBe(true)
      expect(plugins.some(plugin => plugin.includes('npm'))).toBe(true)
      expect(plugins.some(plugin => plugin.includes('version'))).toBe(true)
      expect(plugins.some(plugin => plugin.includes('github'))).toBe(true)
    })

    test('应该使用 require.resolve 解析插件路径', () => {
      const result = internalPreset()

      result.plugins.forEach(plugin => {
        expect(typeof plugin).toBe('string')
        expect(plugin.length).toBeGreaterThan(0)
        // 插件路径应该是绝对路径
        expect(plugin).toMatch(/[/\\]/)
      })
    })

    test('插件应该按照正确的顺序排列', () => {
      const result = internalPreset()
      const plugins = result.plugins

      // 验证插件顺序
      expect(plugins[0]).toContain('register') // register 应该是第一个
      expect(plugins[1]).toContain('bootstrap') // bootstrap 应该是第二个
      expect(plugins[2]).toContain('git')
      expect(plugins[3]).toContain('npm')
      expect(plugins[4]).toContain('version')
      expect(plugins[5]).toContain('github') // github 应该是最后一个
    })

    test('应该是纯函数（无副作用）', () => {
      const result1 = internalPreset()
      const result2 = internalPreset()

      expect(result1).toEqual(result2)
      expect(result1).not.toBe(result2) // 应该返回新的对象实例
    })

    test('返回的对象应该只包含 plugins 属性', () => {
      const result = internalPreset()
      const keys = Object.keys(result)

      expect(keys).toEqual(['plugins'])
    })
  })

  describe('插件路径有效性', () => {
    test('所有插件路径都应该能够被 require 解析', () => {
      const result = internalPreset()

      result.plugins.forEach(pluginPath => {
        expect(() => {
          require.resolve(pluginPath)
        }).not.toThrow()
      })
    })

    test('插件文件应该存在', () => {
      const result = internalPreset()

      result.plugins.forEach(pluginPath => {
        expect(() => {
          const resolvedPath = require.resolve(pluginPath)
          expect(resolvedPath).toBeTruthy()
        }).not.toThrow()
      })
    })
  })

  describe('预设配置结构', () => {
    test('应该符合 pluggable 预设格式', () => {
      const result = internalPreset()

      // 应该有 plugins 数组
      expect(result.plugins).toBeDefined()
      expect(Array.isArray(result.plugins)).toBe(true)

      // 插件应该是字符串路径
      result.plugins.forEach(plugin => {
        expect(typeof plugin).toBe('string')
      })
    })

    test('不应该包含 presets 属性', () => {
      const result = internalPreset()

      expect(result).not.toHaveProperty('presets')
    })

    test('不应该包含其他不相关的属性', () => {
      const result = internalPreset()
      const allowedKeys = ['plugins', 'presets']

      Object.keys(result).forEach(key => {
        expect(allowedKeys).toContain(key)
      })
    })
  })
})
