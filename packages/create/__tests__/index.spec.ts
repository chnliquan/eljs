import { describe, expect, expectTypeOf, it } from 'vitest'

import {
  ProjectCreator,
  type OfficialTemplateName,
  type ProjectCreatorOptions,
} from '../src'

describe('create 公共入口', () => {
  it('应该导出精确的官方模板名称类型', () => {
    expectTypeOf<ProjectCreatorOptions['template']>().toEqualTypeOf<
      OfficialTemplateName | undefined
    >()
    expectTypeOf<OfficialTemplateName>().toEqualTypeOf<
      'template-npm-package' | 'template-project'
    >()
  })

  it('应该导出创建器', () => {
    expect(ProjectCreator).toBeTypeOf('function')
  })

  it('应该公开创建器构造选项类型', () => {
    const options: ProjectCreatorOptions = {
      cwd: '/workspace',
      template: 'template-npm-package',
    }

    expect(options.template).toBe('template-npm-package')
  })
})
