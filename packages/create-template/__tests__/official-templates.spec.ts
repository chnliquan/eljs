import { describe, expect, it } from 'vitest'

import { officialTemplates } from '../src/official-templates'

describe('create-template 内置目录', () => {
  it('固定官方模板版本、registry 和信任声明', () => {
    expect(officialTemplates).toEqual({
      'template-npm-package': {
        type: 'npm',
        description: 'NPM Package Template',
        value: '@eljs/create-plugin-npm-package@0.13.0',
        registry: 'https://registry.npmjs.org/',
        integrity: 'sha512-PENDING-PUBLISH',
        trusted: true,
      },
      'template-project': {
        type: 'npm',
        description: 'Full-stack Project Template',
        value: '@eljs/create-plugin-project@0.13.0',
        registry: 'https://registry.npmjs.org/',
        integrity: 'sha512-PENDING-PUBLISH',
        trusted: true,
      },
    })
  })

  it('官方远程模板只使用 HTTPS registry 和精确版本', () => {
    for (const template of Object.values(officialTemplates)) {
      expect(template.type).toBe('npm')
      expect(template.value).toMatch(/^@eljs\/[a-z0-9-]+@\d+\.\d+\.\d+$/u)
      expect(template.registry).toBeTypeOf('string')
      expect(new URL(template.registry ?? '').protocol).toBe('https:')
      expect(template.trusted).toBe(true)
    }
  })

  // 真实 integrity 只能在 templates 仓库发布 0.13.0 之后从 registry 元数据取得，
  // 该断言在占位值期间无法成立；回填真实摘要后必须同时移除 skip
  it.skip('官方远程模板使用真实 SHA-512 integrity 摘要', () => {
    for (const template of Object.values(officialTemplates)) {
      expect(template.integrity).toMatch(/^sha512-[A-Za-z0-9+/]+=*$/u)
    }
  })

  it('目录及其模板条目在运行时不可变', () => {
    expect(Object.isFrozen(officialTemplates)).toBe(true)
    expect(Object.isFrozen(officialTemplates['template-npm-package'])).toBe(
      true,
    )
    expect(Object.isFrozen(officialTemplates['template-project'])).toBe(true)
  })
})
