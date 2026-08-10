import { describe, expect, it } from 'vitest'

import { officialTemplates } from '../src/official-templates'

describe('create-template 内置目录', () => {
  it('固定官方模板版本、registry 和信任声明', () => {
    expect(officialTemplates).toEqual({
      'template-npm-web': {
        type: 'npm',
        description: 'Web Common Template',
        value: '@eljs/create-plugin-npm-web@0.12.1',
        registry: 'https://registry.npmjs.org/',
        integrity:
          'sha512-PnCXo/ZbnGnQqdFQjG9jI1jXRn9ZV8l4DWE6Txxjmu40PkCF6MRfqCGpCBd4PN2flAKCph+DUaNrKM+6lKrrww==',
        trusted: true,
      },
      'template-npm-node': {
        type: 'npm',
        description: 'Node Common Template',
        value: '@eljs/create-plugin-npm-node@0.12.1',
        registry: 'https://registry.npmjs.org/',
        integrity:
          'sha512-51zCeHJUTzpp0Gxpnn2LcWAPJOeKi1d9HUF5TIQ2pZDzrdnyuSm5quViki9kMKiYTzwf6HckEvw5I5rD3yQm8A==',
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
      expect(template.integrity).toMatch(/^sha512-[A-Za-z0-9+/]+=*$/u)
      expect(template.trusted).toBe(true)
    }
  })

  it('目录及其模板条目在运行时不可变', () => {
    expect(Object.isFrozen(officialTemplates)).toBe(true)
    expect(Object.isFrozen(officialTemplates['template-npm-web'])).toBe(true)
    expect(Object.isFrozen(officialTemplates['template-npm-node'])).toBe(true)
  })
})
