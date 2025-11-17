import type { PackageJson, PackageManager } from '@eljs/utils'

import type { AppData, Paths, Prompts } from '../../src/types/runner'
import { RunnerStageEnum } from '../../src/types/runner'

describe('Runner 类型', () => {
  describe('Paths 接口', () => {
    it('应该定义必需的路径属性', () => {
      const paths: Paths = {
        cwd: '/current/working/directory',
        target: '/target/directory',
      }

      expect(paths.cwd).toBe('/current/working/directory')
      expect(paths.target).toBe('/target/directory')
    })

    it('应该允许其他字符串属性', () => {
      const paths: Paths = {
        cwd: '/current/working/directory',
        target: '/target/directory',
        templates: '/templates/path',
        cache: '/cache/path',
        customPath: '/custom/path',
      }

      expect(paths.templates).toBe('/templates/path')
      expect(paths.cache).toBe('/cache/path')
      expect(paths.customPath).toBe('/custom/path')
    })

    it('应该需要 cwd 和 target 属性', () => {
      // 测试 cwd 和 target 都是必需的
      const validPaths: Paths = {
        cwd: '/cwd',
        target: '/target',
      }

      expect(validPaths.cwd).toBeDefined()
      expect(validPaths.target).toBeDefined()
    })
  })

  describe('AppData 接口', () => {
    it('应该正确定义必需的属性', () => {
      const mockPackageJson: PackageJson = {
        name: 'test-project',
        version: '1.0.0',
      }

      const appData: AppData = {
        scene: 'web',
        cliVersion: '2.1.0',
        pkg: mockPackageJson,
        projectName: 'my-project',
        packageManager: 'npm',
      }

      expect(appData.scene).toBe('web')
      expect(appData.cliVersion).toBe('2.1.0')
      expect(appData.pkg).toBe(mockPackageJson)
      expect(appData.projectName).toBe('my-project')
      expect(appData.packageManager).toBe('npm')
    })

    it('应该只允许有效的场景值', () => {
      const webScene: AppData['scene'] = 'web'
      const nodeScene: AppData['scene'] = 'node'

      expect(['web', 'node']).toContain(webScene)
      expect(['web', 'node']).toContain(nodeScene)
    })

    it('应该允许有效的包管理器值', () => {
      const packageManagers: PackageManager[] = ['npm', 'yarn', 'pnpm']

      packageManagers.forEach(pm => {
        const appData: AppData = {
          scene: 'web',
          cliVersion: '1.0.0',
          pkg: { name: 'test' },
          projectName: 'test',
          packageManager: pm,
        }

        expect(['npm', 'yarn', 'pnpm']).toContain(appData.packageManager)
      })
    })

    it('应该允许任意类型的其他属性', () => {
      const appData: AppData = {
        scene: 'node',
        cliVersion: '1.0.0',
        pkg: { name: 'test' },
        projectName: 'test',
        packageManager: 'yarn',
        customString: 'custom value',
        customNumber: 42,
        customBoolean: true,
        customObject: { nested: 'value' },
        customArray: [1, 2, 3],
      }

      expect(appData.customString).toBe('custom value')
      expect(appData.customNumber).toBe(42)
      expect(appData.customBoolean).toBe(true)
      expect(appData.customObject).toEqual({ nested: 'value' })
      expect(appData.customArray).toEqual([1, 2, 3])
    })
  })

  describe('Prompts 接口', () => {
    it('应该定义所有必需的提示属性', () => {
      const prompts: Prompts = {
        author: 'John Doe',
        email: 'john.doe@example.com',
        gitUrl: 'git@github.com:user/repo.git',
        gitHref: 'https://github.com/user/repo',
        registry: 'https://registry.npmjs.org',
        year: '2024',
        date: '2024-01-15',
        dateTime: '2024-01-15 14:30:00',
        dirname: 'my-project',
      }

      expect(prompts.author).toBe('John Doe')
      expect(prompts.email).toBe('john.doe@example.com')
      expect(prompts.gitUrl).toBe('git@github.com:user/repo.git')
      expect(prompts.gitHref).toBe('https://github.com/user/repo')
      expect(prompts.registry).toBe('https://registry.npmjs.org')
      expect(prompts.year).toBe('2024')
      expect(prompts.date).toBe('2024-01-15')
      expect(prompts.dateTime).toBe('2024-01-15 14:30:00')
      expect(prompts.dirname).toBe('my-project')
    })

    it('应该允许任意类型的其他属性', () => {
      const prompts: Prompts = {
        author: 'Jane Smith',
        email: 'jane@example.com',
        gitUrl: 'git@github.com:jane/project.git',
        gitHref: 'https://github.com/jane/project',
        registry: 'https://registry.npmjs.org',
        year: '2024',
        date: '2024-02-20',
        dateTime: '2024-02-20 10:15:30',
        dirname: 'jane-project',
        framework: 'react',
        typescript: true,
        testing: 'jest',
        linting: ['eslint', 'prettier'],
        features: {
          routing: true,
          stateManagement: false,
        },
      }

      expect(prompts.framework).toBe('react')
      expect(prompts.typescript).toBe(true)
      expect(prompts.testing).toBe('jest')
      expect(prompts.linting).toEqual(['eslint', 'prettier'])
      expect(prompts.features).toEqual({
        routing: true,
        stateManagement: false,
      })
    })

    it('应该验证日期和时间字符串格式', () => {
      const prompts: Prompts = {
        author: 'Test User',
        email: 'test@example.com',
        gitUrl: 'git@github.com:test/repo.git',
        gitHref: 'https://github.com/test/repo',
        registry: 'https://registry.npmjs.org',
        year: '2024',
        date: '2024-12-31',
        dateTime: '2024-12-31 23:59:59',
        dirname: 'test-project',
      }

      // 测试年份格式 (YYYY)
      expect(prompts.year).toMatch(/^\d{4}$/)

      // 测试日期格式 (YYYY-MM-DD)
      expect(prompts.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)

      // 测试时间格式 (YYYY-MM-DD hh:mm:ss)
      expect(prompts.dateTime).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    })
  })

  describe('RunnerStageEnum', () => {
    it('应该定义所有预期的阶段', () => {
      const expectedStages = [
        'uninitialized',
        'init',
        'collectAppData',
        'collectPluginConfig',
        'collectPrompts',
        'collectTsConfig',
        'collectJestConfig',
        'collectPrettierConfig',
        'onStart',
      ]

      expectedStages.forEach(stage => {
        expect(Object.values(RunnerStageEnum)).toContain(stage)
      })
    })

    it('应该有正确的枚举值', () => {
      expect(RunnerStageEnum.Uninitialized).toBe('uninitialized')
      expect(RunnerStageEnum.Init).toBe('init')
      expect(RunnerStageEnum.CollectAppData).toBe('collectAppData')
      expect(RunnerStageEnum.CollectPluginConfig).toBe('collectPluginConfig')
      expect(RunnerStageEnum.CollectPrompts).toBe('collectPrompts')
      expect(RunnerStageEnum.CollectTsConfig).toBe('collectTsConfig')
      expect(RunnerStageEnum.CollectJestConfig).toBe('collectJestConfig')
      expect(RunnerStageEnum.CollectPrettierConfig).toBe(
        'collectPrettierConfig',
      )
      expect(RunnerStageEnum.OnStart).toBe('onStart')
    })

    it('应该可以作为类型和值使用', () => {
      const currentStage: RunnerStageEnum = RunnerStageEnum.Init
      expect(currentStage).toBe('init')

      // 测试可以在接受枚举类型的函数中使用
      function processStage(stage: RunnerStageEnum): string {
        if (stage === RunnerStageEnum.Init) {
          return '正在初始化'
        } else if (stage === RunnerStageEnum.CollectAppData) {
          return '正在收集应用数据'
        }
        return '未知阶段'
      }

      expect(processStage(RunnerStageEnum.Init)).toBe('正在初始化')
      expect(processStage(RunnerStageEnum.CollectAppData)).toBe(
        '正在收集应用数据',
      )
    })

    it('应该有正确数量的枚举值', () => {
      const enumValues = Object.values(RunnerStageEnum)
      expect(enumValues).toHaveLength(9)
    })

    it('应该为工作流程维护枚举顺序', () => {
      const enumValues = Object.values(RunnerStageEnum)
      const expectedOrder = [
        'uninitialized',
        'init',
        'collectAppData',
        'collectPluginConfig',
        'collectPrompts',
        'collectTsConfig',
        'collectJestConfig',
        'collectPrettierConfig',
        'onStart',
      ]

      expect(enumValues).toEqual(expectedOrder)
    })
  })
})
