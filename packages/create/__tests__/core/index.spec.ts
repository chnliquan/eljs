import { describe, expect, it } from 'vitest'
import { CreateRunner } from '../../src/core/create-runner'
import * as coreIndex from '../../src/core/index'
import { ProjectCreator } from '../../src/core/project-creator'
import { TemplateDownloader } from '../../src/core/template-downloader'

describe('Core 模块导出测试', () => {
  it('应该导出ProjectCreator类', () => {
    expect(coreIndex.ProjectCreator).toBe(ProjectCreator)
    expect(typeof coreIndex.ProjectCreator).toBe('function')
  })

  it('应该导出TemplateDownloader类', () => {
    expect(coreIndex.TemplateDownloader).toBe(TemplateDownloader)
    expect(typeof coreIndex.TemplateDownloader).toBe('function')
  })

  it('应该导出CreateRunner类', () => {
    expect(coreIndex.CreateRunner).toBe(CreateRunner)
    expect(typeof coreIndex.CreateRunner).toBe('function')
  })

  it('应该有正确数量的导出', () => {
    const exports = Object.keys(coreIndex)
    expect(exports).toHaveLength(3)
    expect(exports).toContain('ProjectCreator')
    expect(exports).toContain('TemplateDownloader')
    expect(exports).toContain('CreateRunner')
  })

  it('应该导出可构造的类', () => {
    // Test that exported classes can be instantiated
    expect(
      () => new coreIndex.ProjectCreator({ template: 'test' }),
    ).not.toThrow()
    expect(
      () => new coreIndex.TemplateDownloader({ type: 'npm', value: 'test' }),
    ).not.toThrow()
    expect(
      () => new coreIndex.CreateRunner({ cwd: process.cwd() }),
    ).not.toThrow()
  })

  it('应该维护正确的原型链', () => {
    const create = new coreIndex.ProjectCreator({ template: 'test' })
    const download = new coreIndex.TemplateDownloader({
      type: 'npm',
      value: 'test',
    })
    const runner = new coreIndex.CreateRunner({ cwd: process.cwd() })

    expect(create).toBeInstanceOf(ProjectCreator)
    expect(download).toBeInstanceOf(TemplateDownloader)
    expect(runner).toBeInstanceOf(CreateRunner)
  })

  describe('类型兼容性测试', () => {
    it('应该导出具有正确TypeScript类型的类', () => {
      // This test ensures TypeScript types are properly exported
      // The fact that this compiles ensures type compatibility

      const createClass: typeof ProjectCreator = coreIndex.ProjectCreator
      const downloadClass: typeof TemplateDownloader =
        coreIndex.TemplateDownloader
      const runnerClass: typeof CreateRunner = coreIndex.CreateRunner

      expect(createClass).toBe(ProjectCreator)
      expect(downloadClass).toBe(TemplateDownloader)
      expect(runnerClass).toBe(CreateRunner)
    })
  })
})
