import { describe, expect, it } from 'vitest'

import { CreateTemplate, type CreateTemplateOptions } from '../src'

describe('create-template 公共入口', () => {
  it('应该导出创建器', () => {
    expect(CreateTemplate).toBeTypeOf('function')
  })

  it('应该公开创建器构造选项类型', () => {
    const options: CreateTemplateOptions = {
      cwd: '/workspace',
      template: 'template-npm-web',
    }

    expect(options.template).toBe('template-npm-web')
  })
})
