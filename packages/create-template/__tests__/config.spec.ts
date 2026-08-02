import { describe, expect, it } from 'vitest'

import { defaultConfig, type TemplateConfig } from '../src/config'

describe('create-template 内置目录', () => {
  it('固定官方模板版本、registry 和信任声明', () => {
    expect(defaultConfig).toEqual({
      scenes: { npm: 'NPM' },
      templates: {
        npm: {
          'template-npm-web': {
            type: 'npm',
            description: 'Web Common Template',
            value: '@eljs/create-plugin-npm-web@0.12.2',
            registry: 'https://registry.npmjs.org/',
            trusted: true,
          },
          'template-npm-node': {
            type: 'npm',
            description: 'Node Common Template',
            value: '@eljs/create-plugin-npm-node@0.12.2',
            registry: 'https://registry.npmjs.org/',
            trusted: true,
          },
        },
      },
    })
  })

  it('场景与模板映射保持一一对应', () => {
    const config: TemplateConfig = defaultConfig

    expect(Object.keys(config.templates).sort()).toEqual(
      Object.keys(config.scenes).sort(),
    )

    for (const scene of Object.keys(config.scenes)) {
      expect(Object.keys(config.templates[scene])).not.toHaveLength(0)
    }
  })

  it('官方远程模板只使用 HTTPS registry 和精确版本', () => {
    for (const templates of Object.values(defaultConfig.templates)) {
      for (const template of Object.values(templates)) {
        expect(template.type).toBe('npm')
        expect(template.value).toMatch(/^@eljs\/[a-z0-9-]+@\d+\.\d+\.\d+$/u)
        expect(template.registry).toBeTypeOf('string')
        expect(new URL(template.registry || '').protocol).toBe('https:')
        expect(template.trusted).toBe(true)
      }
    }
  })

  it('目录及其嵌套对象在运行时不可变', () => {
    expect(Object.isFrozen(defaultConfig)).toBe(true)
    expect(Object.isFrozen(defaultConfig.scenes)).toBe(true)
    expect(Object.isFrozen(defaultConfig.templates)).toBe(true)
    expect(Object.isFrozen(defaultConfig.templates.npm)).toBe(true)
    expect(
      Object.isFrozen(defaultConfig.templates.npm['template-npm-web']),
    ).toBe(true)
  })
})
