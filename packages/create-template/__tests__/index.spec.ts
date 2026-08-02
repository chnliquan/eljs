import { describe, expect, it } from 'vitest'

import {
  CreateTemplate,
  defaultConfig,
  type CreateTemplateOptions,
} from '../src'

describe('create-template 公共入口', () => {
  it('应该导出创建器和内置模版目录', () => {
    expect(CreateTemplate).toBeTypeOf('function')
    expect(defaultConfig.templates.npm).toBeDefined()
  })

  it('应该公开创建器构造选项类型', () => {
    const options: CreateTemplateOptions = {
      cwd: '/workspace',
      scene: 'npm',
      template: 'template-npm-web',
    }

    expect(options.scene).toBe('npm')
  })
})
