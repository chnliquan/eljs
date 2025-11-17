import { Create } from '../../src/core/create'
import { Download } from '../../src/core/download'
import * as coreIndex from '../../src/core/index'
import { Runner } from '../../src/core/runner'

describe('Core 模块导出测试', () => {
  it('应该导出Create类', () => {
    expect(coreIndex.Create).toBe(Create)
    expect(typeof coreIndex.Create).toBe('function')
  })

  it('应该导出Download类', () => {
    expect(coreIndex.Download).toBe(Download)
    expect(typeof coreIndex.Download).toBe('function')
  })

  it('应该导出Runner类', () => {
    expect(coreIndex.Runner).toBe(Runner)
    expect(typeof coreIndex.Runner).toBe('function')
  })

  it('应该有正确数量的导出', () => {
    const exports = Object.keys(coreIndex)
    expect(exports).toHaveLength(3)
    expect(exports).toContain('Create')
    expect(exports).toContain('Download')
    expect(exports).toContain('Runner')
  })

  it('应该导出可构造的类', () => {
    // Test that exported classes can be instantiated
    expect(() => new coreIndex.Create({ template: 'test' })).not.toThrow()
    expect(
      () => new coreIndex.Download({ type: 'npm', value: 'test' }),
    ).not.toThrow()
    expect(() => new coreIndex.Runner({ cwd: process.cwd() })).not.toThrow()
  })

  it('应该维护正确的原型链', () => {
    const create = new coreIndex.Create({ template: 'test' })
    const download = new coreIndex.Download({ type: 'npm', value: 'test' })
    const runner = new coreIndex.Runner({ cwd: process.cwd() })

    expect(create).toBeInstanceOf(Create)
    expect(download).toBeInstanceOf(Download)
    expect(runner).toBeInstanceOf(Runner)
  })

  describe('类型兼容性测试', () => {
    it('应该导出具有正确TypeScript类型的类', () => {
      // This test ensures TypeScript types are properly exported
      // The fact that this compiles ensures type compatibility

      const createClass: typeof Create = coreIndex.Create
      const downloadClass: typeof Download = coreIndex.Download
      const runnerClass: typeof Runner = coreIndex.Runner

      expect(createClass).toBe(Create)
      expect(downloadClass).toBe(Download)
      expect(runnerClass).toBe(Runner)
    })
  })
})
