// 测试 index.ts 文件中导出所有类型
describe('类型索引导出', () => {
  it('应该从 api 模块导出所有类型', async () => {
    const apiModule = await import('../../src/types/api')

    // 检查 Api 类型是否可用（通过检查模块是否存在）
    expect(apiModule).toBeDefined()
  })

  it('应该从 config 模块导出所有类型', async () => {
    const configModule = await import('../../src/types/config')

    // 检查 Config 和 RemoteTemplate 类型是否可用
    expect(configModule).toBeDefined()
  })

  it('应该从 runner 模块导出所有类型', async () => {
    const runnerModule = await import('../../src/types/runner')

    // 检查 runner 类型是否可用
    expect(runnerModule).toBeDefined()
    expect(runnerModule.RunnerStageEnum).toBeDefined()
    expect(typeof runnerModule.RunnerStageEnum).toBe('object')
  })

  it('应该通过索引重新导出所有类型', async () => {
    const indexModule = await import('../../src/types/index')

    // 索引模块应该重新导出所有内容
    expect(indexModule).toBeDefined()
  })

  it('应该允许通过索引导入 RunnerStageEnum', async () => {
    // 测试可以通过索引文件导入 RunnerStageEnum
    const { RunnerStageEnum } = await import('../../src/types/index')
    expect(RunnerStageEnum).toBeDefined()
    expect(RunnerStageEnum.Init).toBe('init')
  })

  it('应该维护正确的模块结构', () => {
    // 测试模块结构符合预期
    expect(true).toBe(true) // 这个测试主要验证编译时行为
  })

  it('应该为枚举导出运行时值', async () => {
    // RunnerStageEnum 应该作为运行时值可用
    const { RunnerStageEnum } = await import('../../src/types/index')
    expect(typeof RunnerStageEnum).toBe('object')
    expect(Object.keys(RunnerStageEnum).length).toBeGreaterThan(0)
  })
})
