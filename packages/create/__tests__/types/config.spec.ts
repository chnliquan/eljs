import type { Config, RemoteTemplate } from '../../src/types/config'

describe('Config 类型', () => {
  it('应该正确定义 RemoteTemplate 接口', () => {
    const npmTemplate: RemoteTemplate = {
      type: 'npm',
      value: '@eljs/template-react',
      registry: 'https://registry.npmjs.org',
    }

    const gitTemplate: RemoteTemplate = {
      type: 'git',
      value: 'https://github.com/example/template.git',
    }

    expect(npmTemplate.type).toBe('npm')
    expect(npmTemplate.value).toBe('@eljs/template-react')
    expect(npmTemplate.registry).toBe('https://registry.npmjs.org')

    expect(gitTemplate.type).toBe('git')
    expect(gitTemplate.value).toBe('https://github.com/example/template.git')
    expect(gitTemplate.registry).toBeUndefined()
  })

  it('应该只允许有效的模板类型', () => {
    // 测试有效类型
    const validTypes: Array<RemoteTemplate['type']> = ['npm', 'git']

    validTypes.forEach(type => {
      const template: RemoteTemplate = {
        type,
        value: 'test-value',
      }
      expect(['npm', 'git']).toContain(template.type)
    })
  })

  it('应该定义扩展 UserConfig 的 Config 接口', () => {
    const basicConfig: Config = {}

    // 测试 Config 扩展 UserConfig（结构测试）
    expect(basicConfig).toBeDefined()
    expect(typeof basicConfig).toBe('object')
  })

  it('应该允许 Config 中的所有可选属性', () => {
    const fullConfig: Config = {
      cwd: '/custom/working/directory',
      template: '/path/to/template',
      force: true,
      merge: false,
      defaultQuestions: true,
      gitInit: true,
      install: true,
    }

    expect(fullConfig.cwd).toBe('/custom/working/directory')
    expect(fullConfig.template).toBe('/path/to/template')
    expect(fullConfig.force).toBe(true)
    expect(fullConfig.merge).toBe(false)
    expect(fullConfig.defaultQuestions).toBe(true)
    expect(fullConfig.gitInit).toBe(true)
    expect(fullConfig.install).toBe(true)
  })

  it('应该允许 template 为字符串类型', () => {
    const configWithStringTemplate: Config = {
      template: '/local/template/path',
    }

    expect(configWithStringTemplate.template).toBe('/local/template/path')
    expect(typeof configWithStringTemplate.template).toBe('string')
  })

  it('应该允许 template 为 RemoteTemplate 类型', () => {
    const remoteTemplate: RemoteTemplate = {
      type: 'npm',
      value: '@eljs/template-vue',
      registry: 'https://registry.npmjs.org',
    }

    const configWithRemoteTemplate: Config = {
      template: remoteTemplate,
    }

    expect(configWithRemoteTemplate.template).toBe(remoteTemplate)
    expect(typeof configWithRemoteTemplate.template).toBe('object')
    expect((configWithRemoteTemplate.template as RemoteTemplate).type).toBe(
      'npm',
    )
  })

  it('应该有符合文档的正确默认值', () => {
    // 通过检查接口允许未定义值来测试默认行为
    const configWithDefaults: Config = {
      cwd: undefined, // 默认: process.cwd()
      force: undefined, // 默认: false
      merge: undefined, // 默认: false
      defaultQuestions: undefined, // 默认: true
      gitInit: undefined, // 默认: true
      install: undefined, // 默认: true
    }

    // 所有属性都应该是可选的
    expect(configWithDefaults.cwd).toBeUndefined()
    expect(configWithDefaults.force).toBeUndefined()
    expect(configWithDefaults.merge).toBeUndefined()
    expect(configWithDefaults.defaultQuestions).toBeUndefined()
    expect(configWithDefaults.gitInit).toBeUndefined()
    expect(configWithDefaults.install).toBeUndefined()
  })

  it('应该允许标志的布尔值', () => {
    const configWithBooleans: Config = {
      force: true,
      merge: true,
      defaultQuestions: false,
      gitInit: false,
      install: false,
    }

    expect(configWithBooleans.force).toBe(true)
    expect(configWithBooleans.merge).toBe(true)
    expect(configWithBooleans.defaultQuestions).toBe(false)
    expect(configWithBooleans.gitInit).toBe(false)
    expect(configWithBooleans.install).toBe(false)
  })

  it('应该验证 RemoteTemplate registry 为可选', () => {
    const templateWithoutRegistry: RemoteTemplate = {
      type: 'git',
      value: 'https://github.com/example/repo.git',
    }

    const templateWithRegistry: RemoteTemplate = {
      type: 'npm',
      value: 'package-name',
      registry: 'https://custom-registry.com',
    }

    expect(templateWithoutRegistry.registry).toBeUndefined()
    expect(templateWithRegistry.registry).toBe('https://custom-registry.com')
  })

  it('应该支持复杂的配置场景', () => {
    const complexConfig: Config = {
      cwd: '/workspace/project',
      template: {
        type: 'npm',
        value: '@company/custom-template',
        registry: 'https://npm.company.com',
      },
      force: true,
      merge: false,
      defaultQuestions: false,
      gitInit: true,
      install: true,
    }

    expect(complexConfig.cwd).toBe('/workspace/project')
    expect((complexConfig.template as RemoteTemplate).type).toBe('npm')
    expect((complexConfig.template as RemoteTemplate).value).toBe(
      '@company/custom-template',
    )
    expect((complexConfig.template as RemoteTemplate).registry).toBe(
      'https://npm.company.com',
    )
    expect(complexConfig.force).toBe(true)
    expect(complexConfig.merge).toBe(false)
    expect(complexConfig.defaultQuestions).toBe(false)
    expect(complexConfig.gitInit).toBe(true)
    expect(complexConfig.install).toBe(true)
  })

  it('应该与空配置兼容', () => {
    const emptyConfig: Config = {}

    // 应该是一个有效的 Config 对象
    expect(emptyConfig).toBeDefined()
    expect(typeof emptyConfig).toBe('object')

    // 所有属性都应该是未定义的（默认行为）
    expect(Object.keys(emptyConfig)).toHaveLength(0)
  })
})
