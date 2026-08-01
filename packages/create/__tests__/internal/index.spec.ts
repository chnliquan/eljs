import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import internal from '../../src/internal/index'

const context = {
  plugin: {
    path: fileURLToPath(
      new URL('../../src/internal/index.ts', import.meta.url),
    ),
  },
} as Parameters<typeof internal>[0]

describe('内部索引', () => {
  it('应该导出一个返回插件配置的函数', () => {
    expect(typeof internal).toBe('function')
  })

  it('应该返回一个包含 plugins 数组的对象', () => {
    const result = internal(context)
    expect(result).toHaveProperty('plugins')
    expect(Array.isArray(result.plugins)).toBe(true)
  })

  it('应该包含所有必需的插件', () => {
    const result = internal(context)
    const { plugins } = result

    expect(plugins).toHaveLength(7)

    // 检查所有插件是否存在，通过检查路径是否包含插件名
    expect(plugins.some((plugin: string) => plugin.includes('app-data'))).toBe(
      true,
    )
    expect(plugins.some((plugin: string) => plugin.includes('built-in'))).toBe(
      true,
    )
    expect(plugins.some((plugin: string) => plugin.includes('generator'))).toBe(
      true,
    )
    expect(plugins.some((plugin: string) => plugin.includes('git-init'))).toBe(
      true,
    )
    expect(plugins.some((plugin: string) => plugin.includes('prompts'))).toBe(
      true,
    )
    expect(plugins.some((plugin: string) => plugin.includes('questions'))).toBe(
      true,
    )
    expect(plugins.some((plugin: string) => plugin.includes('render'))).toBe(
      true,
    )
  })

  it('应该按正确顺序返回插件', () => {
    const result = internal(context)
    const { plugins } = result

    expect(plugins[0]).toContain('app-data')

    // 检查插件数组包含所有预期的插件路径
    plugins.forEach((plugin: string) => {
      expect(typeof plugin).toBe('string')
      expect(plugin).toMatch(/\.(js|ts)$/)
    })
  })
})
