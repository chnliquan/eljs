import internal from '../../src/internal/index'

describe('内部索引', () => {
  it('应该导出一个返回插件配置的函数', () => {
    expect(typeof internal).toBe('function')
  })

  it('应该返回一个包含 plugins 数组的对象', () => {
    const result = internal()
    expect(result).toHaveProperty('plugins')
    expect(Array.isArray(result.plugins)).toBe(true)
  })

  it('应该包含所有必需的插件', () => {
    const result = internal()
    const { plugins } = result

    expect(plugins).toHaveLength(8)

    // 检查所有插件是否存在，通过检查路径是否包含插件名
    expect(plugins.some((plugin: string) => plugin.includes('register'))).toBe(
      true,
    )
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
    const result = internal()
    const { plugins } = result

    // 检查顺序，确保 register 排在第一位
    expect(plugins[0]).toContain('register')

    // 检查插件数组包含所有预期的插件路径
    plugins.forEach((plugin: string) => {
      expect(typeof plugin).toBe('string')
      expect(plugin).toMatch(/\.(js|ts)$/)
    })
  })
})
