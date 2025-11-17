/* eslint-disable @typescript-eslint/no-non-null-assertion */
/**
 * @fileoverview config.ts 模块的单元测试
 * @description 测试配置文件相关类型和默认配置
 */

describe('config 模块测试', () => {
  describe('类型定义验证', () => {
    it('应该正确导出 RemoteTemplate 接口类型', async () => {
      // 通过检查默认配置来验证类型定义的正确性
      const { defaultConfig } = await import('../src/config')

      // 获取一个模板实例来验证类型
      const npmWebTemplate = defaultConfig.templates.npm['template-npm-web']

      expect(npmWebTemplate).toHaveProperty('type')
      expect(npmWebTemplate).toHaveProperty('value')
      expect(npmWebTemplate).toHaveProperty('description')
      expect(npmWebTemplate).toHaveProperty('registry')

      // 验证类型的值
      expect(typeof npmWebTemplate.type).toBe('string')
      expect(typeof npmWebTemplate.value).toBe('string')
      expect(typeof npmWebTemplate.description).toBe('string')
      expect(typeof npmWebTemplate.registry).toBe('string')
    })

    it('应该正确导出 TemplateConfig 接口类型', async () => {
      const { defaultConfig } = await import('../src/config')

      // 验证配置结构
      expect(defaultConfig).toHaveProperty('scenes')
      expect(defaultConfig).toHaveProperty('templates')

      // 验证 scenes 结构
      expect(typeof defaultConfig.scenes).toBe('object')
      expect(defaultConfig.scenes).not.toBeNull()

      // 验证 templates 结构
      expect(typeof defaultConfig.templates).toBe('object')
      expect(defaultConfig.templates).not.toBeNull()
    })
  })

  describe('defaultConfig 配置验证', () => {
    let defaultConfig: {
      scenes: Record<string, string>
      templates: Record<
        string,
        Record<
          string,
          {
            type: string
            value: string
            description: string
            registry?: string
          }
        >
      >
    }

    beforeEach(async () => {
      // 重新导入以获取新的配置实例
      const configModule = await import('../src/config')
      defaultConfig = configModule.defaultConfig
    })

    it('应该包含正确的场景配置', () => {
      expect(defaultConfig.scenes).toBeDefined()
      expect(defaultConfig.scenes.npm).toBe('NPM')
      expect(Object.keys(defaultConfig.scenes)).toContain('npm')
    })

    it('应该包含 npm 场景的模板配置', () => {
      expect(defaultConfig.templates.npm).toBeDefined()
      expect(typeof defaultConfig.templates.npm).toBe('object')

      // 验证包含期望的模板
      expect(defaultConfig.templates.npm).toHaveProperty('template-npm-web')
      expect(defaultConfig.templates.npm).toHaveProperty('template-npm-node')
    })

    it('应该正确配置 npm web 模板', () => {
      const webTemplate = defaultConfig.templates.npm['template-npm-web']

      expect(webTemplate.type).toBe('npm')
      expect(webTemplate.description).toBe('Web Common Template')
      expect(webTemplate.value).toBe('@eljs/create-plugin-npm-web')
      expect(webTemplate.registry).toBe('https://registry.npmjs.org/')
    })

    it('应该正确配置 npm node 模板', () => {
      const nodeTemplate = defaultConfig.templates.npm['template-npm-node']

      expect(nodeTemplate.type).toBe('npm')
      expect(nodeTemplate.description).toBe('Node Common Template')
      expect(nodeTemplate.value).toBe('@eljs/create-plugin-npm-node')
      expect(nodeTemplate.registry).toBe('https://registry.npmjs.org/')
    })

    it('所有模板应该包含必需的字段', () => {
      Object.keys(defaultConfig.templates).forEach(sceneKey => {
        const scene = defaultConfig.templates[sceneKey]
        Object.keys(scene).forEach(templateKey => {
          const template = scene[templateKey]

          // 验证必需字段
          expect(template).toHaveProperty('type')
          expect(template).toHaveProperty('value')
          expect(template).toHaveProperty('description')

          // 验证字段类型
          expect(typeof template.type).toBe('string')
          expect(typeof template.value).toBe('string')
          expect(typeof template.description).toBe('string')

          // type 应该是有效值
          expect(['npm', 'git']).toContain(template.type)

          // value 不应为空
          expect(template.value.length).toBeGreaterThan(0)

          // description 不应为空
          expect(template.description.length).toBeGreaterThan(0)
        })
      })
    })

    it('模板 registry 字段应该是有效的 URL', () => {
      Object.keys(defaultConfig.templates).forEach(sceneKey => {
        const scene = defaultConfig.templates[sceneKey]
        Object.keys(scene).forEach(templateKey => {
          const template = scene[templateKey]

          if (template.registry) {
            // 验证是有效的 URL
            expect(() => new URL(template.registry!)).not.toThrow()

            // 验证是 HTTPS 协议
            const url = new URL(template.registry!)
            expect(url.protocol).toBe('https:')
          }
        })
      })
    })
  })

  describe('配置数据完整性', () => {
    it('场景和模板之间应该保持一致性', async () => {
      const { defaultConfig } = await import('../src/config')

      // 每个场景都应该在模板配置中有对应的条目
      Object.keys(defaultConfig.scenes).forEach(sceneKey => {
        expect(defaultConfig.templates).toHaveProperty(sceneKey)
        expect(typeof defaultConfig.templates[sceneKey]).toBe('object')

        // 每个场景至少应该有一个模板
        expect(
          Object.keys(defaultConfig.templates[sceneKey]).length,
        ).toBeGreaterThan(0)
      })
    })

    it('不应该有孤立的模板配置', async () => {
      const { defaultConfig } = await import('../src/config')

      // 模板配置中的每个场景都应该在场景列表中存在
      Object.keys(defaultConfig.templates).forEach(templateSceneKey => {
        expect(defaultConfig.scenes).toHaveProperty(templateSceneKey)
      })
    })
  })

  describe('模块导出验证', () => {
    it('应该正确导出所有预期的成员', async () => {
      const configModule = await import('../src/config')

      expect(configModule).toHaveProperty('defaultConfig')
      expect(typeof configModule.defaultConfig).toBe('object')
    })

    it('应该能够通过 ES Module 方式导入', async () => {
      const configModule = await import('../src/config')

      expect(configModule).toHaveProperty('defaultConfig')
      expect(typeof configModule.defaultConfig).toBe('object')
    })
  })

  describe('模板值验证', () => {
    it('npm 类型的模板值应该是有效的包名', async () => {
      const { defaultConfig } = await import('../src/config')

      Object.keys(defaultConfig.templates).forEach(sceneKey => {
        const scene = defaultConfig.templates[sceneKey]
        Object.keys(scene).forEach(templateKey => {
          const template = scene[templateKey]

          if (template.type === 'npm') {
            // npm 包名应该符合规范
            expect(template.value).toMatch(
              /^[@a-z0-9]([a-z0-9-]*[a-z0-9])?([/][a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/,
            )

            // 当前配置中的包都以 @eljs/ 开头
            expect(template.value).toMatch(/^@eljs\//)
          }
        })
      })
    })

    it('模板描述应该是有意义的文本', async () => {
      const { defaultConfig } = await import('../src/config')

      Object.keys(defaultConfig.templates).forEach(sceneKey => {
        const scene = defaultConfig.templates[sceneKey]
        Object.keys(scene).forEach(templateKey => {
          const template = scene[templateKey]

          // 描述应该包含 "Template" 关键词
          expect(template.description.toLowerCase()).toContain('template')

          // 描述长度应该合理
          expect(template.description.length).toBeGreaterThan(5)
          expect(template.description.length).toBeLessThan(100)
        })
      })
    })
  })

  describe('边界情况测试', () => {
    it('应该处理空的模板场景（如果存在）', async () => {
      const { defaultConfig } = await import('../src/config')

      // 当前配置不应该有空场景，但验证结构健壮性
      Object.keys(defaultConfig.templates).forEach(sceneKey => {
        const sceneTemplates = defaultConfig.templates[sceneKey]
        expect(sceneTemplates).toBeDefined()
        expect(typeof sceneTemplates).toBe('object')

        // 如果场景存在，应该至少有一个模板
        const templateKeys = Object.keys(sceneTemplates)
        expect(templateKeys.length).toBeGreaterThan(0)
      })
    })

    it('应该正确处理模板键名', async () => {
      const { defaultConfig } = await import('../src/config')

      Object.keys(defaultConfig.templates).forEach(sceneKey => {
        const scene = defaultConfig.templates[sceneKey]
        Object.keys(scene).forEach(templateKey => {
          // 模板键名应该是有效的标识符格式
          expect(templateKey).toMatch(/^[a-z0-9-]+$/)

          // 应该包含 'template' 前缀
          expect(templateKey).toMatch(/^template-/)
        })
      })
    })
  })
})
