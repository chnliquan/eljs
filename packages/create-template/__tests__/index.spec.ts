import { describe, expect, it } from 'vitest'

import {
  CreateTemplate,
  defaultConfig,
  type CreateTemplateOptions,
  type TemplateConfig,
} from '../src'

describe('create-template 公共入口', () => {
  it('应该导出创建器和内置模版目录', () => {
    expect(CreateTemplate).toBeTypeOf('function')
    expect(defaultConfig.templates.npm).toBeDefined()
  })

  it('应该公开可组合的目录与构造选项类型', () => {
    const catalog: TemplateConfig = {
      scenes: { local: 'Local' },
      templates: {
        local: {
          fixture: {
            type: 'local',
            value: './fixture',
            description: 'Fixture Template',
          },
        },
      },
    }
    const options: CreateTemplateOptions = { catalog }

    expect(options.catalog).toBe(catalog)
  })
})
