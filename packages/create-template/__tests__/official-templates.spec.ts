import { describe, expect, it } from 'vitest'

import { officialTemplates } from '../src/official-templates'

describe('create-template 内置目录', () => {
  it('固定官方模板来源、registry 和信任声明', () => {
    expect(officialTemplates).toEqual({
      'template-npm-package': {
        type: 'npm',
        description: 'NPM Package Template',
        value: '@eljs/create-plugin-npm-package',
        registry: 'https://registry.npmjs.org/',
        trusted: true,
      },
      'template-project': {
        type: 'npm',
        description: 'Full-stack Project Template',
        value: '@eljs/create-plugin-project',
        registry: 'https://registry.npmjs.org/',
        trusted: true,
      },
    })
  })

  it('官方远程模板只使用 HTTPS registry，且始终跟随 latest', () => {
    for (const template of Object.values(officialTemplates)) {
      expect(template.type).toBe('npm')
      expect(template.value).toMatch(/^@eljs\/[a-z0-9-]+$/u)
      expect(template.registry).toBeTypeOf('string')
      expect(new URL(template.registry ?? '').protocol).toBe('https:')
      expect(template.trusted).toBe(true)
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
