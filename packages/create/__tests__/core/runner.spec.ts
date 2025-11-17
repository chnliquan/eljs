/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file packages/create runner 模块完整单元测试
 * @description 全面测试 Runner 类的核心功能和类型安全特性，100% 测试覆盖率
 */

import { Runner } from '../../src/core/runner'
import {
  RunnerStageEnum,
  type AppData,
  type Paths,
  type Prompts,
} from '../../src/types'

// 模拟所有依赖
jest.mock('@eljs/pluggable')
jest.mock('@eljs/utils')
jest.mock('../../src/default')

// 模拟 console.log
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {})

describe('Runner 类完整测试', () => {
  const mockCwd = process.cwd() // 使用真实路径避免验证错误

  afterAll(() => {
    mockConsoleLog.mockRestore()
  })

  beforeEach(() => {
    jest.clearAllMocks()

    // 重新设置基本的模拟
    const { deepMerge, prompts } = require('@eljs/utils')
    deepMerge.mockImplementation((target: any, ...sources: any[]) => ({
      ...target,
      ...sources.reduce((acc, source) => ({ ...acc, ...source }), {}),
    }))
    prompts.mockResolvedValue({})

    // 模拟 Pluggable 基类
    const { Pluggable } = require('@eljs/pluggable')
    Pluggable.mockImplementation(function (this: any, options: any) {
      this.cwd = options.cwd || process.cwd()
      this.userConfig = null
      this.constructorOptions = options
      this.load = jest.fn().mockResolvedValue(undefined)
      this.applyPlugins = jest
        .fn()
        .mockImplementation((name: string, options?: any) => {
          if (name === 'modifyPaths') {
            return Promise.resolve(options.initialValue)
          }
          if (name === 'modifyAppData') {
            return Promise.resolve(options.initialValue)
          }
          if (name === 'addQuestions') {
            return Promise.resolve(options.initialValue)
          }
          if (name === 'modifyPrompts') {
            return Promise.resolve(options.initialValue)
          }
          if (name === 'modifyTsConfig') {
            return Promise.resolve(options.initialValue)
          }
          if (name === 'modifyJestConfig') {
            return Promise.resolve(options.initialValue)
          }
          if (name === 'modifyPrettierConfig') {
            return Promise.resolve(options.initialValue)
          }
          return Promise.resolve(undefined)
        })
    })

    // 模拟默认配置
    const defaultConfig = require('../../src/default')
    defaultConfig.defaultConfig = {
      cwd: process.cwd(),
      force: false,
      defaultQuestions: true,
      gitInit: true,
      install: true,
    }
  })

  describe('基础功能和方法测试', () => {
    it('应该有 run 方法', () => {
      const runner = new Runner({ cwd: mockCwd })
      expect(typeof runner.run).toBe('function')
      expect(runner.run.length).toBe(2) // target, projectName 两个参数
    })

    it('应该正确初始化所有属性', () => {
      const runner = new Runner({ cwd: mockCwd })

      expect(runner.stage).toBe(RunnerStageEnum.Uninitialized)
      expect(typeof runner.paths).toBe('object')
      expect(typeof runner.appData).toBe('object')
      expect(typeof runner.prompts).toBe('object')
      expect(typeof runner.tsConfig).toBe('object')
      expect(typeof runner.jestConfig).toBe('object')
      expect(typeof runner.prettierConfig).toBe('object')
    })

    it('应该有继承的方法', () => {
      const runner = new Runner({ cwd: mockCwd })
      expect('load' in runner).toBe(true)
      expect('applyPlugins' in runner).toBe(true)
    })

    it('初始属性应该有正确的类型和默认值', () => {
      const runner = new Runner({ cwd: mockCwd })

      expect(runner.stage).toBe(RunnerStageEnum.Uninitialized)
      expect(typeof runner.paths).toBe('object')
      expect(typeof runner.appData).toBe('object')
      expect(typeof runner.prompts).toBe('object')
      expect(typeof runner.tsConfig).toBe('object')
      expect(typeof runner.jestConfig).toBe('object')
      expect(typeof runner.prettierConfig).toBe('object')

      // 验证初始值为空对象
      expect(Object.keys(runner.paths)).toHaveLength(0)
      expect(Object.keys(runner.appData)).toHaveLength(0)
      expect(Object.keys(runner.prompts)).toHaveLength(0)
      expect(Object.keys(runner.tsConfig)).toHaveLength(0)
      expect(Object.keys(runner.jestConfig)).toHaveLength(0)
      expect(Object.keys(runner.prettierConfig)).toHaveLength(0)
    })

    it('应该有所有必需的公共方法', () => {
      const runner = new Runner({ cwd: mockCwd })

      expect(typeof runner.run).toBe('function')
      expect(typeof (runner as any).applyPlugins).toBe('function')
    })
  })

  describe('Runner 构造函数测试', () => {
    it('应该成功创建 Runner 实例', () => {
      const runner = new Runner({ cwd: '/test' })

      expect(runner).toBeInstanceOf(Runner)
      expect(runner.stage).toBe(RunnerStageEnum.Uninitialized)
      expect(runner.paths).toEqual({})
      expect(runner.appData).toEqual({})
      expect(runner.prompts).toEqual({})
      expect(runner.tsConfig).toEqual({})
      expect(runner.jestConfig).toEqual({})
      expect(runner.prettierConfig).toEqual({})
    })

    it('应该正确传递配置到 Pluggable 基类', () => {
      const { Pluggable } = require('@eljs/pluggable')
      const config = {
        cwd: '/test/path',
        presets: ['preset1'],
        plugins: ['plugin1'],
      }

      new Runner(config)

      expect(Pluggable).toHaveBeenCalledWith({
        cwd: '/test/path',
        presets: [expect.stringMatching(/internal/), 'preset1'],
        plugins: ['plugin1'],
        defaultConfigFiles: ['create.config.ts', 'create.config.js'],
      })
    })

    it('应该正确处理默认配置', () => {
      const { Pluggable } = require('@eljs/pluggable')

      new Runner({ cwd: '/test' })

      expect(Pluggable).toHaveBeenCalledWith({
        cwd: '/test',
        defaultConfigFiles: ['create.config.ts', 'create.config.js'],
        presets: [expect.stringMatching(/internal/)],
        plugins: undefined,
      })
    })

    it('应该设置正确的默认配置文件', () => {
      const { Pluggable } = require('@eljs/pluggable')

      new Runner({ cwd: '/test' })

      expect(Pluggable).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultConfigFiles: ['create.config.ts', 'create.config.js'],
        }),
      )
    })

    it('应该将内置 preset 添加到 presets 数组的开头', () => {
      const { Pluggable } = require('@eljs/pluggable')

      new Runner({ cwd: '/test', presets: ['custom-preset'] })

      expect(Pluggable).toHaveBeenCalledWith(
        expect.objectContaining({
          presets: [expect.stringMatching(/internal/), 'custom-preset'],
        }),
      )
    })
  })

  describe('Runner run 方法核心测试', () => {
    let runner: Runner

    beforeEach(() => {
      runner = new Runner({ cwd: '/test' })
    })

    it('应该按正确顺序执行所有阶段', async () => {
      const target = '/test/project'
      const projectName = 'test-project'

      await runner.run(target, projectName)

      // 验证 load 被调用
      expect((runner as any).load).toHaveBeenCalledTimes(1)

      // 验证 applyPlugins 被按正确顺序调用
      const applyPluginsCalls = ((runner as any).applyPlugins as jest.Mock).mock
        .calls

      expect(applyPluginsCalls[0][0]).toBe('modifyPaths')
      expect(applyPluginsCalls[1][0]).toBe('modifyAppData')
      expect(applyPluginsCalls[2][0]).toBe('addQuestions')
      expect(applyPluginsCalls[3][0]).toBe('modifyPrompts')
      expect(applyPluginsCalls[4][0]).toBe('modifyTsConfig')
      expect(applyPluginsCalls[5][0]).toBe('modifyJestConfig')
      expect(applyPluginsCalls[6][0]).toBe('modifyPrettierConfig')
      expect(applyPluginsCalls[7][0]).toBe('onStart')
      expect(applyPluginsCalls[8][0]).toBe('onBeforeGenerateFiles')
      expect(applyPluginsCalls[9][0]).toBe('onGenerateFiles')
      expect(applyPluginsCalls[10][0]).toBe('onGenerateDone')
    })

    it('应该正确设置 modifyPaths 的初始值', async () => {
      const target = '/test/project'
      const projectName = 'test-project'

      await runner.run(target, projectName)

      const modifyPathsCall = (
        (runner as any).applyPlugins as jest.Mock
      ).mock.calls.find((call: any) => call[0] === 'modifyPaths')

      expect(modifyPathsCall[1]).toEqual({
        initialValue: {
          cwd: (runner as any).cwd,
          target,
        },
        args: {
          cwd: (runner as any).cwd,
        },
      })
    })

    it('应该正确设置 modifyAppData 的初始值', async () => {
      const target = '/test/project'
      const projectName = 'test-project'

      await runner.run(target, projectName)

      const modifyAppDataCall = (
        (runner as any).applyPlugins as jest.Mock
      ).mock.calls.find((call: any) => call[0] === 'modifyAppData')

      expect(modifyAppDataCall[1]).toEqual({
        initialValue: {
          scene: 'web',
          cliVersion: '1.3.1',
          pkg: {},
          projectName,
          packageManager: 'pnpm',
        },
        args: {
          cwd: (runner as any).cwd,
        },
      })
    })

    it('应该正确更新执行阶段', async () => {
      const target = '/test/project'
      const projectName = 'test-project'

      // 初始状态
      expect(runner.stage).toBe(RunnerStageEnum.Uninitialized)

      await runner.run(target, projectName)

      // 执行完成后应该处于 OnStart 阶段
      expect(runner.stage).toBe(RunnerStageEnum.OnStart)
    })

    it('应该按顺序更新各配置阶段的 stage', async () => {
      const target = '/test/project'
      const projectName = 'test-project'
      const stageChanges: RunnerStageEnum[] = []

      // 监听 stage 变化
      let originalStage = runner.stage
      Object.defineProperty(runner, 'stage', {
        set(value) {
          if (value !== originalStage) {
            stageChanges.push(value)
            originalStage = value
          }
        },
        get() {
          return originalStage
        },
        configurable: true,
      })

      await runner.run(target, projectName)

      expect(stageChanges).toEqual([
        RunnerStageEnum.CollectAppData,
        RunnerStageEnum.CollectTsConfig,
        RunnerStageEnum.CollectJestConfig,
        RunnerStageEnum.CollectPrettierConfig,
        RunnerStageEnum.OnStart,
      ])
    })

    it('应该正确设置 paths 属性', async () => {
      const target = '/test/project'
      const projectName = 'test-project'
      const expectedPaths = {
        cwd: (runner as any).cwd,
        target,
        customPath: '/custom',
      }

      ;((runner as any).applyPlugins as jest.Mock).mockImplementation(
        (name: string, options?: any) => {
          if (name === 'modifyPaths') {
            return Promise.resolve(expectedPaths)
          }
          return Promise.resolve(options?.initialValue || {})
        },
      )

      await runner.run(target, projectName)

      expect(runner.paths).toEqual(expectedPaths)
    })

    it('应该正确设置 appData 属性', async () => {
      const target = '/test/project'
      const projectName = 'test-project'
      const expectedAppData = {
        scene: 'web',
        cliVersion: '1.3.1',
        pkg: { name: 'test' },
        projectName,
        packageManager: 'npm',
        customField: 'value',
      }

      ;((runner as any).applyPlugins as jest.Mock).mockImplementation(
        (name: string, options?: any) => {
          if (name === 'modifyAppData') {
            return Promise.resolve(expectedAppData)
          }
          return Promise.resolve(options?.initialValue || {})
        },
      )

      await runner.run(target, projectName)

      expect(runner.appData).toEqual(expectedAppData)
    })

    it('应该正确处理 questions 和 prompts', async () => {
      const target = '/test/project'
      const projectName = 'test-project'
      const questions = [
        { type: 'input', name: 'author', message: 'Author?' },
        { type: 'input', name: 'email', message: 'Email?' },
      ]
      const expectedPrompts = { author: 'John', email: 'john@example.com' }

      ;((runner as any).applyPlugins as jest.Mock).mockImplementation(
        (name: string, options?: any) => {
          if (name === 'addQuestions') {
            return Promise.resolve(questions)
          }
          if (name === 'modifyPrompts') {
            expect(options.args.questions).toEqual(questions)
            return Promise.resolve(expectedPrompts)
          }
          return Promise.resolve(options?.initialValue || {})
        },
      )

      await runner.run(target, projectName)

      expect(runner.prompts).toEqual(expectedPrompts)
    })

    it('应该正确设置各种配置对象', async () => {
      const target = '/test/project'
      const projectName = 'test-project'
      const tsConfig = { compilerOptions: { target: 'es2020' } }
      const jestConfig = { testEnvironment: 'node' }
      const prettierConfig = { semi: false }

      ;((runner as any).applyPlugins as jest.Mock).mockImplementation(
        (name: string, options?: any) => {
          if (name === 'modifyTsConfig') {
            return Promise.resolve(tsConfig)
          }
          if (name === 'modifyJestConfig') {
            return Promise.resolve(jestConfig)
          }
          if (name === 'modifyPrettierConfig') {
            return Promise.resolve(prettierConfig)
          }
          return Promise.resolve(options?.initialValue || {})
        },
      )

      await runner.run(target, projectName)

      expect(runner.tsConfig).toEqual(tsConfig)
      expect(runner.jestConfig).toEqual(jestConfig)
      expect(runner.prettierConfig).toEqual(prettierConfig)
    })

    it('应该在事件钩子中传递正确的参数', async () => {
      const target = '/test/project'
      const projectName = 'test-project'
      const mockPaths = { cwd: (runner as any).cwd, target }
      const mockPrompts = { author: 'Test Author' }

      ;((runner as any).applyPlugins as jest.Mock).mockImplementation(
        (name: string, options?: any) => {
          if (name === 'modifyPaths') {
            return Promise.resolve(mockPaths)
          }
          if (name === 'modifyPrompts') {
            return Promise.resolve(mockPrompts)
          }
          return Promise.resolve(options?.initialValue || {})
        },
      )

      await runner.run(target, projectName)

      const onBeforeGenerateFilesCall = (
        (runner as any).applyPlugins as jest.Mock
      ).mock.calls.find((call: any) => call[0] === 'onBeforeGenerateFiles')
      const onGenerateFilesCall = (
        (runner as any).applyPlugins as jest.Mock
      ).mock.calls.find((call: any) => call[0] === 'onGenerateFiles')

      expect(onBeforeGenerateFilesCall[1]).toEqual({
        args: {
          prompts: mockPrompts,
          paths: mockPaths,
        },
      })

      expect(onGenerateFilesCall[1]).toEqual({
        args: {
          prompts: mockPrompts,
          paths: mockPaths,
        },
      })
    })

    it('应该处理异步插件调用错误', async () => {
      const target = '/test/project'
      const projectName = 'test-project'
      const error = new Error('Plugin error')

      ;((runner as any).applyPlugins as jest.Mock).mockImplementation(
        (name: string) => {
          if (name === 'modifyAppData') {
            return Promise.reject(error)
          }
          return Promise.resolve({})
        },
      )

      await expect(runner.run(target, projectName)).rejects.toThrow(
        'Plugin error',
      )
    })

    it('应该处理 load 方法错误', async () => {
      const target = '/test/project'
      const projectName = 'test-project'
      const error = new Error('Load error')

      ;((runner as any).load as jest.Mock).mockRejectedValue(error)

      await expect(runner.run(target, projectName)).rejects.toThrow(
        'Load error',
      )
    })
  })

  describe('Runner _resolveConfig 私有方法测试', () => {
    it('应该正确合并配置', async () => {
      const { deepMerge } = require('@eljs/utils')
      const { defaultConfig } = require('../../src/default')

      const userConfig = { force: true, customOption: 'value' }
      const constructorOptions = { cwd: '/test', install: false }

      const runner = new Runner(constructorOptions)
      ;(runner as any).userConfig = userConfig

      // 调用 run 来触发 _resolveConfig
      await runner.run('/test/target', 'test-project')

      expect(deepMerge).toHaveBeenCalledWith(
        {},
        defaultConfig,
        expect.objectContaining({
          cwd: '/test',
          install: false,
        }),
        userConfig,
      )
    })

    it('应该处理空的用户配置', async () => {
      const { deepMerge } = require('@eljs/utils')
      const { defaultConfig } = require('../../src/default')

      const constructorOptions = { cwd: '/test' }
      const runner = new Runner(constructorOptions)
      ;(runner as any).userConfig = null

      await runner.run('/test/target', 'test-project')

      expect(deepMerge).toHaveBeenCalledWith(
        {},
        defaultConfig,
        expect.objectContaining({
          cwd: '/test',
        }),
        {},
      )
    })

    it('应该将合并结果分配给 config 属性', async () => {
      const { deepMerge } = require('@eljs/utils')
      const mergedConfig = {
        cwd: '/test',
        force: true,
        defaultQuestions: false,
        gitInit: true,
        install: false,
        customOption: 'merged',
      }

      deepMerge.mockReturnValue(mergedConfig)

      const runner = new Runner({ cwd: '/test' })

      await runner.run('/test/target', 'test-project')

      expect(runner.config).toEqual(mergedConfig)
    })

    it('应该有所有必需的公共属性', async () => {
      const runner = new Runner({ cwd: '/test' })

      // config 属性只有在 run 之后才会被设置
      await runner.run('/test/target', 'test-project')

      expect(runner).toHaveProperty('config')
      expect(runner).toHaveProperty('stage')
      expect(runner).toHaveProperty('paths')
      expect(runner).toHaveProperty('appData')
      expect(runner).toHaveProperty('prompts')
      expect(runner).toHaveProperty('tsConfig')
      expect(runner).toHaveProperty('jestConfig')
      expect(runner).toHaveProperty('prettierConfig')
    })
  })

  describe('Runner 配置验证和处理', () => {
    it('应该接受各种配置组合', () => {
      const configs = [
        { cwd: '/test' },
        { cwd: '/test', presets: ['preset1'] },
        { cwd: '/test', plugins: ['plugin1'] },
        {
          cwd: '/test',
          presets: ['preset1', 'preset2'],
          plugins: ['plugin1', 'plugin2'],
        },
      ]

      configs.forEach(config => {
        expect(() => new Runner(config)).not.toThrow()
      })
    })

    it('应该正确处理 presets 数组', () => {
      const { Pluggable } = require('@eljs/pluggable')

      // 空数组
      new Runner({ cwd: '/test', presets: [] })
      expect(Pluggable).toHaveBeenLastCalledWith(
        expect.objectContaining({
          presets: [expect.stringMatching(/internal/)],
        }),
      )

      // 单个 preset
      new Runner({ cwd: '/test', presets: ['single-preset'] })
      expect(Pluggable).toHaveBeenLastCalledWith(
        expect.objectContaining({
          presets: [expect.stringMatching(/internal/), 'single-preset'],
        }),
      )

      // 多个 presets
      new Runner({ cwd: '/test', presets: ['preset1', 'preset2', 'preset3'] })
      expect(Pluggable).toHaveBeenLastCalledWith(
        expect.objectContaining({
          presets: [
            expect.stringMatching(/internal/),
            'preset1',
            'preset2',
            'preset3',
          ],
        }),
      )
    })

    it('应该正确处理 plugins 数组', () => {
      const { Pluggable } = require('@eljs/pluggable')

      // undefined plugins
      new Runner({ cwd: '/test' })
      expect(Pluggable).toHaveBeenLastCalledWith(
        expect.objectContaining({
          plugins: undefined,
        }),
      )

      // 空数组
      new Runner({ cwd: '/test', plugins: [] })
      expect(Pluggable).toHaveBeenLastCalledWith(
        expect.objectContaining({
          plugins: [],
        }),
      )

      // 多个 plugins
      new Runner({ cwd: '/test', plugins: ['plugin1', 'plugin2'] })
      expect(Pluggable).toHaveBeenLastCalledWith(
        expect.objectContaining({
          plugins: ['plugin1', 'plugin2'],
        }),
      )
    })
  })

  describe('类型安全的配置对象管理测试', () => {
    it('应该管理类型安全的 paths 配置', () => {
      const runner = new Runner({ cwd: mockCwd })

      interface DetailedPaths extends Paths {
        src: string
        lib: string
        dist: string
        types: string
        docs: string
        examples: string
        config: string
        scripts: string
        assets: string
        public: string
      }

      const detailedPaths: DetailedPaths = {
        cwd: mockCwd,
        target: '/detailed/target',
        src: '/detailed/target/src',
        lib: '/detailed/target/lib',
        dist: '/detailed/target/dist',
        types: '/detailed/target/types',
        docs: '/detailed/target/docs',
        examples: '/detailed/target/examples',
        config: '/detailed/target/config',
        scripts: '/detailed/target/scripts',
        assets: '/detailed/target/assets',
        public: '/detailed/target/public',
      }

      runner.paths = detailedPaths
      expect(runner.paths).toEqual(detailedPaths)
      expect(Object.keys(runner.paths)).toHaveLength(12) // 包含所有字段
      expect(runner.paths.src).toBe('/detailed/target/src')
      expect(runner.paths.assets).toBe('/detailed/target/assets')
    })

    it('应该管理类型安全的 appData 配置', () => {
      const runner = new Runner({ cwd: mockCwd })

      interface DetailedAppData extends AppData {
        framework: 'react' | 'vue' | 'angular' | 'svelte'
        bundler: 'webpack' | 'vite' | 'rollup' | 'parcel'
        cssFramework: 'tailwindcss' | 'bootstrap' | 'bulma' | 'materialize'
        stateManagement: 'redux' | 'zustand' | 'mobx' | 'recoil'
        testing: 'jest' | 'vitest' | 'mocha' | 'jasmine'
        linting: 'eslint' | 'tslint' | 'biome'
        formatting: 'prettier' | 'biome'
        typeChecking: 'typescript' | 'flow'
        deployment: 'vercel' | 'netlify' | 'aws' | 'docker'
        features: Array<'auth' | 'api' | 'ui' | 'testing' | 'docs' | 'i18n'>
        environment: 'development' | 'staging' | 'production'
      }

      const detailedAppData: DetailedAppData = {
        scene: 'web',
        cliVersion: '1.3.1',
        pkg: {
          name: 'detailed-project',
          version: '2.1.0',
          description: 'A detailed project for comprehensive testing',
          author: 'Detailed Author',
          license: 'MIT',
          keywords: ['detailed', 'testing', 'typescript', 'react'],
          repository: {
            type: 'git',
            url: 'https://github.com/detailed/project',
          },
          homepage: 'https://detailed-project.dev',
        },
        projectName: 'detailed-project',
        packageManager: 'pnpm',
        framework: 'react',
        bundler: 'vite',
        cssFramework: 'tailwindcss',
        stateManagement: 'zustand',
        testing: 'jest',
        linting: 'eslint',
        formatting: 'prettier',
        typeChecking: 'typescript',
        deployment: 'vercel',
        features: ['auth', 'api', 'ui', 'testing', 'docs'],
        environment: 'production',
      }

      runner.appData = detailedAppData
      expect(runner.appData).toEqual(detailedAppData)
      expect(runner.appData.framework).toBe('react')
      expect(runner.appData.features).toContain('auth')
      expect(runner.appData.environment).toBe('production')
    })

    it('应该管理类型安全的 prompts 配置', () => {
      const runner = new Runner({ cwd: mockCwd })

      interface DetailedPrompts extends Prompts {
        description: string
        license: 'MIT' | 'Apache-2.0' | 'GPL-3.0' | 'ISC' | 'BSD-3-Clause'
        keywords: string[]
        homepage: string
        repository: string
        bugs: string
        features: Array<
          | 'authentication'
          | 'authorization'
          | 'api'
          | 'ui'
          | 'testing'
          | 'documentation'
          | 'internationalization'
          | 'pwa'
          | 'ssr'
        >
        deployment: 'vercel' | 'netlify' | 'aws' | 'docker' | 'manual'
        ci: 'github-actions' | 'gitlab-ci' | 'travis-ci' | 'circle-ci' | 'none'
        monitoring: 'sentry' | 'bugsnag' | 'rollbar' | 'none'
        analytics: 'google-analytics' | 'mixpanel' | 'amplitude' | 'none'
      }

      const detailedPrompts: DetailedPrompts = {
        author: 'Expert Developer',
        email: 'expert@professional.dev',
        gitUrl: 'git@github.com:expert/professional-project.git',
        gitHref: 'https://github.com/expert/professional-project',
        registry: 'https://registry.npmjs.org',
        year: '2024',
        date: '2024-11-17',
        dateTime: '2024-11-17 18:00:00',
        dirname: 'professional-project',
        description:
          'A professional-grade TypeScript project with comprehensive features',
        license: 'MIT',
        keywords: [
          'typescript',
          'react',
          'vite',
          'tailwindcss',
          'professional',
        ],
        homepage: 'https://professional-project.dev',
        repository: 'https://github.com/expert/professional-project',
        bugs: 'https://github.com/expert/professional-project/issues',
        features: [
          'authentication',
          'api',
          'ui',
          'testing',
          'documentation',
          'pwa',
        ],
        deployment: 'vercel',
        ci: 'github-actions',
        monitoring: 'sentry',
        analytics: 'google-analytics',
      }

      runner.prompts = detailedPrompts
      expect(runner.prompts).toEqual(detailedPrompts)
      expect(runner.prompts.license).toBe('MIT')
      expect(runner.prompts.features).toContain('authentication')
      expect(runner.prompts.deployment).toBe('vercel')
      expect(runner.prompts.keywords).toHaveLength(5)
    })
  })

  describe('Runner 边界条件测试', () => {
    it('应该处理空字符串参数', async () => {
      const runner = new Runner({ cwd: '/test' })

      await expect(runner.run('', '')).resolves.not.toThrow()
      expect(runner.appData.projectName).toBe('')
    })

    it('应该处理特殊字符路径', async () => {
      const runner = new Runner({ cwd: '/test' })
      const target = '/test/项目 with spaces & symbols!'
      const projectName = 'project-测试'

      await runner.run(target, projectName)

      expect(runner.paths.target).toBe(target)
      expect(runner.appData.projectName).toBe(projectName)
    })

    it('应该处理长路径和项目名', async () => {
      const runner = new Runner({ cwd: '/test' })
      const longTarget = '/very/long/path/' + 'a'.repeat(100)
      const longProjectName = 'project-' + 'n'.repeat(100)

      await runner.run(longTarget, longProjectName)

      expect(runner.paths.target).toBe(longTarget)
      expect(runner.appData.projectName).toBe(longProjectName)
    })

    it('应该处理插件返回 null 或 undefined', async () => {
      const runner = new Runner({ cwd: '/test' })

      ;((runner as any).applyPlugins as jest.Mock).mockImplementation(
        (name: string, options?: any) => {
          if (name === 'modifyTsConfig') {
            return Promise.resolve(null)
          }
          if (name === 'modifyJestConfig') {
            return Promise.resolve(undefined)
          }
          return Promise.resolve(options?.initialValue || {})
        },
      )

      await runner.run('/test/target', 'test-project')

      expect(runner.tsConfig).toBeNull()
      expect(runner.jestConfig).toBeUndefined()
    })
  })

  describe('Runner 性能测试', () => {
    it('应该在合理时间内完成执行', async () => {
      const runner = new Runner({ cwd: '/test' })
      const startTime = Date.now()

      await runner.run('/test/target', 'test-project')

      const endTime = Date.now()
      const duration = endTime - startTime

      // 应该在 1 秒内完成（在模拟环境下）
      expect(duration).toBeLessThan(1000)
    })

    it('应该处理多次并发 run 调用', async () => {
      const runner = new Runner({ cwd: '/test' })

      const promises = [
        runner.run('/test/target1', 'project1'),
        runner.run('/test/target2', 'project2'),
        runner.run('/test/target3', 'project3'),
      ]

      // 应该都能成功完成，虽然可能会有竞态条件
      await expect(Promise.all(promises)).resolves.toBeDefined()
    })
  })

  describe('阶段管理类型安全测试', () => {
    it('应该支持所有工作流程阶段的类型安全转换', () => {
      const runner = new Runner({ cwd: mockCwd })

      // 定义阶段转换的类型
      const stageTransitions: Array<{
        from: RunnerStageEnum
        to: RunnerStageEnum
        description: string
      }> = [
        {
          from: RunnerStageEnum.Uninitialized,
          to: RunnerStageEnum.Init,
          description: '初始化到启动',
        },
        {
          from: RunnerStageEnum.Init,
          to: RunnerStageEnum.CollectAppData,
          description: '启动到收集应用数据',
        },
        {
          from: RunnerStageEnum.CollectAppData,
          to: RunnerStageEnum.CollectTsConfig,
          description: '收集应用数据到收集TS配置',
        },
        {
          from: RunnerStageEnum.CollectTsConfig,
          to: RunnerStageEnum.CollectJestConfig,
          description: '收集TS配置到收集Jest配置',
        },
        {
          from: RunnerStageEnum.CollectJestConfig,
          to: RunnerStageEnum.CollectPrettierConfig,
          description: '收集Jest配置到收集Prettier配置',
        },
        {
          from: RunnerStageEnum.CollectPrettierConfig,
          to: RunnerStageEnum.OnStart,
          description: '收集Prettier配置到开始执行',
        },
      ]

      stageTransitions.forEach(({ from, to }) => {
        runner.stage = from
        expect(runner.stage).toBe(from)

        runner.stage = to
        expect(runner.stage).toBe(to)
      })
    })

    it('应该支持阶段相关的配置设置', () => {
      const runner = new Runner({ cwd: mockCwd })

      // 类型安全的阶段配置映射
      const stageConfigurations: Record<
        RunnerStageEnum,
        {
          stage: RunnerStageEnum
          config: Partial<AppData | Paths | Prompts | Record<string, unknown>>
        }
      > = {
        [RunnerStageEnum.Uninitialized]: {
          stage: RunnerStageEnum.Uninitialized,
          config: {},
        },
        [RunnerStageEnum.Init]: {
          stage: RunnerStageEnum.Init,
          config: {},
        },
        [RunnerStageEnum.CollectAppData]: {
          stage: RunnerStageEnum.CollectAppData,
          config: {
            scene: 'web' as const,
            projectName: 'stage-test',
            packageManager: 'pnpm' as const,
          },
        },
        [RunnerStageEnum.CollectPluginConfig]: {
          stage: RunnerStageEnum.CollectPluginConfig,
          config: {},
        },
        [RunnerStageEnum.CollectPrompts]: {
          stage: RunnerStageEnum.CollectPrompts,
          config: {
            author: 'Stage Author',
            email: 'stage@test.com',
          },
        },
        [RunnerStageEnum.CollectTsConfig]: {
          stage: RunnerStageEnum.CollectTsConfig,
          config: {
            compilerOptions: { target: 'es2020' },
          },
        },
        [RunnerStageEnum.CollectJestConfig]: {
          stage: RunnerStageEnum.CollectJestConfig,
          config: {
            testEnvironment: 'node',
          },
        },
        [RunnerStageEnum.CollectPrettierConfig]: {
          stage: RunnerStageEnum.CollectPrettierConfig,
          config: {
            semi: true,
          },
        },
        [RunnerStageEnum.OnStart]: {
          stage: RunnerStageEnum.OnStart,
          config: {},
        },
      }

      Object.values(stageConfigurations).forEach(({ stage, config }) => {
        runner.stage = stage
        expect(runner.stage).toBe(stage)

        if (stage === RunnerStageEnum.CollectAppData && config) {
          runner.appData = {
            scene: 'web',
            cliVersion: '1.3.1',
            pkg: {},
            projectName: 'stage-test',
            packageManager: 'pnpm',
            ...config,
          }
        }
      })
    })
  })

  describe('Runner 集成测试', () => {
    it('应该完整执行一个典型的项目创建流程', async () => {
      const runner = new Runner({
        cwd: '/workspace',
        presets: ['@eljs/preset-react'],
        plugins: ['@eljs/plugin-typescript'],
      })

      const mockPaths = {
        cwd: '/workspace',
        target: '/workspace/my-react-app',
        src: '/workspace/my-react-app/src',
        public: '/workspace/my-react-app/public',
      }

      const mockAppData = {
        scene: 'web' as const,
        cliVersion: '1.3.1',
        pkg: {
          name: 'my-react-app',
          version: '1.0.0',
          scripts: {
            start: 'react-scripts start',
            build: 'react-scripts build',
            test: 'react-scripts test',
          },
        },
        projectName: 'my-react-app',
        packageManager: 'npm' as const,
        framework: 'react',
        typescript: true,
      }

      const mockPrompts = {
        author: 'John Doe',
        email: 'john@example.com',
        gitUrl: 'git@github.com:johndoe/my-react-app.git',
        gitHref: 'https://github.com/johndoe/my-react-app',
        registry: 'https://registry.npmjs.org',
        year: '2024',
        date: '2024-11-17',
        dateTime: '2024-11-17 10:00:00',
        dirname: 'my-react-app',
      }

      const mockTsConfig = {
        compilerOptions: {
          target: 'es5',
          lib: ['dom', 'dom.iterable', 'es6'],
          allowJs: true,
          skipLibCheck: true,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          strict: true,
          forceConsistentCasingInFileNames: true,
          moduleResolution: 'node',
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          jsx: 'react-jsx',
        },
        include: ['src'],
      }

      ;((runner as any).applyPlugins as jest.Mock).mockImplementation(
        (name: string, options?: any) => {
          switch (name) {
            case 'modifyPaths':
              return Promise.resolve(mockPaths)
            case 'modifyAppData':
              return Promise.resolve(mockAppData)
            case 'addQuestions':
              return Promise.resolve([])
            case 'modifyPrompts':
              return Promise.resolve(mockPrompts)
            case 'modifyTsConfig':
              return Promise.resolve(mockTsConfig)
            case 'modifyJestConfig':
              return Promise.resolve({})
            case 'modifyPrettierConfig':
              return Promise.resolve({})
            default:
              return Promise.resolve(options?.initialValue || {})
          }
        },
      )

      await runner.run('/workspace/my-react-app', 'my-react-app')

      // 验证所有阶段都被正确执行
      expect(runner.stage).toBe(RunnerStageEnum.OnStart)
      expect(runner.paths).toEqual(mockPaths)
      expect(runner.appData).toEqual(mockAppData)
      expect(runner.prompts).toEqual(mockPrompts)
      expect(runner.tsConfig).toEqual(mockTsConfig)

      // 验证所有插件钩子都被调用
      expect((runner as any).applyPlugins).toHaveBeenCalledWith('onStart')
      expect((runner as any).applyPlugins).toHaveBeenCalledWith(
        'onBeforeGenerateFiles',
        {
          args: {
            prompts: mockPrompts,
            paths: mockPaths,
          },
        },
      )
      expect((runner as any).applyPlugins).toHaveBeenCalledWith(
        'onGenerateFiles',
        {
          args: {
            prompts: mockPrompts,
            paths: mockPaths,
          },
        },
      )
      expect((runner as any).applyPlugins).toHaveBeenCalledWith(
        'onGenerateDone',
      )
    })

    it('应该支持企业级应用的完整类型配置', () => {
      const runner = new Runner({ cwd: mockCwd })

      interface EnterpriseConfig {
        appData: AppData & {
          organization: string
          division: string
          compliance: string[]
          security: {
            level: 'standard' | 'enhanced' | 'strict'
            features: string[]
          }
          deployment: {
            strategy: 'blue-green' | 'rolling' | 'canary'
            environments: string[]
          }
        }
        paths: Paths & {
          artifacts: string
          logs: string
          monitoring: string
          backup: string
        }
      }

      const enterpriseConfig: EnterpriseConfig = {
        appData: {
          scene: 'web',
          cliVersion: '1.3.1',
          pkg: {
            name: '@enterprise/corporate-app',
            version: '3.1.0',
            private: true,
          },
          projectName: 'corporate-app',
          packageManager: 'pnpm',
          organization: 'Enterprise Corp',
          division: 'Technology',
          compliance: ['SOX', 'GDPR', 'HIPAA'],
          security: {
            level: 'strict',
            features: ['2fa', 'encryption', 'audit-logging'],
          },
          deployment: {
            strategy: 'blue-green',
            environments: ['development', 'staging', 'production'],
          },
        },
        paths: {
          cwd: mockCwd,
          target: '/enterprise/app',
          artifacts: '/enterprise/app/artifacts',
          logs: '/enterprise/app/logs',
          monitoring: '/enterprise/app/monitoring',
          backup: '/enterprise/app/backup',
        },
      }

      runner.appData = enterpriseConfig.appData
      runner.paths = enterpriseConfig.paths

      expect(runner.appData.organization).toBe('Enterprise Corp')
      expect(runner.appData.security.level).toBe('strict')
      expect(runner.appData.compliance).toContain('GDPR')
      expect(runner.paths.artifacts).toBe('/enterprise/app/artifacts')
    })
  })
})
