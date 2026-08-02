import * as importedModule1 from '@eljs/plugin-host'
import * as importedModule0 from '@eljs/utils'
import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest'

/**
 * @file packages/release runner 模块单元测试
 * @description 测试 ReleaseRunner 类的核心功能
 */

import { ReleaseRunner } from '../src/release-runner'
import type { Config } from '../src/types'

const requiredModule1 = vi.mocked(importedModule1, { deep: true })
const requiredModule0 = vi.mocked(importedModule0, { deep: true })

// 模拟所有依赖
vi.mock('@eljs/plugin-host', async importOriginal => {
  const actual = await importOriginal<typeof import('@eljs/plugin-host')>()
  return { ...actual, PluginHost: vi.fn() }
})
vi.mock('@eljs/utils', () => ({
  chalk: {
    cyan: vi.fn((text: string) => text),
  },
  createDebugger: vi.fn(() => vi.fn()),
  deepMerge: vi.fn(),
  getPackageManager: vi.fn(),
  pathExistsSync: vi.fn(),
  logger: {
    error: vi.fn(),
    step: vi.fn(),
    warn: vi.fn(),
  },
  readJsonSync: vi.fn(),
}))
vi.mock('@eljs/utils/file', async () => import('@eljs/utils'))
vi.mock('@eljs/utils/logger', async () => import('@eljs/utils'))
vi.mock('@eljs/utils/npm', async () => import('@eljs/utils'))
vi.mock('@eljs/utils/object', async () => import('@eljs/utils'))
vi.mock('../src/default')
vi.mock('../src/internal/release-lock', () => ({
  ReleaseLock: {
    acquire: vi.fn().mockResolvedValue({ release: vi.fn() }),
  },
}))
vi.mock('../src/utils')

// 模拟 console.log
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

describe('ReleaseRunner 类测试', () => {
  afterAll(() => {
    mockConsoleLog.mockRestore()
  })

  beforeEach(() => {
    vi.clearAllMocks()

    // 重新设置基本的模拟
    const {
      deepMerge,
      getPackageManager,
      pathExistsSync,
      readJsonSync,
      logger,
    } = requiredModule0
    const { PluginHost } = requiredModule1
    ;(PluginHost as unknown as Mock).mockImplementation(function (
      this: InstanceType<typeof PluginHost>,
      options: ConstructorParameters<typeof PluginHost>[0],
    ) {
      const target = this as unknown as {
        readonly cwd: string
        runHook: ReturnType<typeof vi.fn>
        constructorOptions: ConstructorParameters<typeof PluginHost>[0]
        load: ReturnType<typeof vi.fn>
        userConfig: Config | null
      }
      target.constructorOptions = options
      Object.defineProperty(target, 'cwd', {
        configurable: true,
        get: () => target.constructorOptions.cwd,
      })
      target.userConfig = null
      target.load = vi.fn().mockResolvedValue(undefined)
      target.runHook = vi
        .fn()
        .mockImplementation((_key, options) =>
          Promise.resolve(options?.initialValue),
        )
    })
    pathExistsSync.mockReturnValue(true)
    getPackageManager.mockResolvedValue('npm')
    deepMerge.mockReturnValue({
      cwd: process.cwd(),
      dryRun: false,
      git: {
        requireClean: true,
        changelog: {
          filename: 'CHANGELOG.md',
          placeholder: 'No changes',
        },
        independent: false,
        commit: true,
        commitMessage: 'chore: release ${version}',
        push: true,
        pushArgs: ['--follow-tags'],
      },
      npm: {
        requireOwner: true,
        networkConcurrency: 8,
        canary: false,
        confirm: true,
      },
      github: {
        release: true,
        mode: 'browser',
        tokenEnv: 'GITHUB_TOKEN',
      },
    })
    readJsonSync.mockReturnValue({ name: 'it-package', version: '1.0.0' })
    logger.error.mockClear()
    logger.step.mockClear()
    logger.warn.mockClear()
  })

  describe('ReleaseRunner 构造函数', () => {
    it('应该成功创建 ReleaseRunner 实例', () => {
      const runner = new ReleaseRunner()

      expect(runner).toBeInstanceOf(ReleaseRunner)
      expect(() => runner.appData).toThrow(
        expect.objectContaining({ code: 'PLUGIN_HOST_INVALID_STATE' }),
      )
    })

    it('应该拒绝在配置解析前读取最终配置', () => {
      const runner = new ReleaseRunner()

      expect(() => runner.config).toThrow(
        expect.objectContaining({
          code: 'PLUGIN_HOST_INVALID_STATE',
        }),
      )
    })

    it('应该使用指定的工作目录', () => {
      const cwd = '/custom/path'
      const runner = new ReleaseRunner({ cwd })

      expect(runner).toBeInstanceOf(ReleaseRunner)
    })

    it('应该将相对工作目录规范化为绝对路径', () => {
      new ReleaseRunner({ cwd: 'fixtures/project' })

      expect(requiredModule0.pathExistsSync).toHaveBeenCalledWith(
        `${process.cwd()}/fixtures/project/package.json`,
      )
    })

    it('应该正确验证 package.json 路径', () => {
      const { pathExistsSync } = requiredModule0
      const itPath = '/it/project'

      new ReleaseRunner({ cwd: itPath })

      expect(pathExistsSync).toHaveBeenCalledWith('/it/project/package.json')
    })

    it('当 package.json 不存在时应该抛出 AppError', () => {
      const { pathExistsSync } = requiredModule0
      pathExistsSync.mockReturnValue(false)

      expect(() => new ReleaseRunner()).toThrow()
    })

    it('当 package.json 没有 version 字段时应该抛出 AppError', () => {
      const { readJsonSync } = requiredModule0
      readJsonSync.mockReturnValue({ name: 'it' })

      expect(() => new ReleaseRunner()).toThrow()
    })

    it('应该在准备阶段完成前隐藏不完整的 appData', () => {
      const mockPkg = { name: 'it-package', version: '2.0.0' }
      const { readJsonSync } = requiredModule0
      readJsonSync.mockReturnValue(mockPkg)

      const runner = new ReleaseRunner({ cwd: '/it/path' })

      expect(() => runner.appData).toThrow('modifyAppData')
      expect(runner['_initialAppData']).toEqual({
        branch: '',
        latestTag: null,
        projectPkg: mockPkg,
        projectPkgJsonPath: '/it/path/package.json',
        workspacePackages: [],
      })
    })

    it('应该正确传递配置到 PluginHost', () => {
      const { PluginHost } = requiredModule1
      const config: Config = {
        cwd: '/it',
        presets: ['preset1'],
        plugins: ['plugin1'],
      }

      new ReleaseRunner(config)

      expect(PluginHost).toHaveBeenCalledWith(
        expect.objectContaining({
          cwd: '/it',
          presets: [expect.stringMatching(/internal/), 'preset1'],
          plugins: ['plugin1'],
          defaultConfigFiles: ['release.config.ts', 'release.config.js'],
        }),
        expect.any(Object),
      )
    })

    it('应该正确处理默认值', () => {
      const { PluginHost } = requiredModule1

      new ReleaseRunner()

      expect(PluginHost).toHaveBeenCalledWith(
        expect.objectContaining({
          cwd: expect.any(String),
          presets: [expect.stringMatching(/internal/)],
          plugins: [],
        }),
        expect.any(Object),
      )
    })

    it('应该验证 version 字段的有效性', () => {
      const { readJsonSync } = requiredModule0
      const validVersions = ['1.0.0', '0.1.0', '10.20.30', '1.0.0-alpha.1']

      validVersions.forEach(version => {
        readJsonSync.mockReturnValue({ name: 'it', version })
        expect(() => new ReleaseRunner()).not.toThrow()
      })
    })

    it('应该拒绝无效的 version 字段', () => {
      const { readJsonSync } = requiredModule0
      const invalidVersions = [null, undefined, '', false, 0]

      invalidVersions.forEach(version => {
        readJsonSync.mockReturnValue({ name: 'it', version })
        expect(() => new ReleaseRunner()).toThrow()
      })
    })
  })

  describe('ReleaseRunner step 方法', () => {
    it('应该调用 logger.step 方法', () => {
      const { logger } = requiredModule0
      const runner = new ReleaseRunner()
      const message = '测试步骤'

      runner.step(message)

      expect(logger.step).toHaveBeenCalledWith('Release', `${message}\n`)
    })

    it('应该正确格式化不同类型的消息', () => {
      const { logger } = requiredModule0
      const runner = new ReleaseRunner()

      runner.step('开始发布')
      runner.step('版本检查完成')
      runner.step('发布成功')

      expect(logger.step).toHaveBeenCalledTimes(3)
      expect(logger.step).toHaveBeenNthCalledWith(1, 'Release', '开始发布\n')
      expect(logger.step).toHaveBeenNthCalledWith(
        2,
        'Release',
        '版本检查完成\n',
      )
      expect(logger.step).toHaveBeenNthCalledWith(3, 'Release', '发布成功\n')
    })

    it('应该处理空消息', () => {
      const { logger } = requiredModule0
      const runner = new ReleaseRunner()

      runner.step('')

      expect(logger.step).toHaveBeenCalledWith('Release', '\n')
    })

    it('应该处理特殊字符', () => {
      const { logger } = requiredModule0
      const runner = new ReleaseRunner()
      const message = '发布 v1.0.0 🚀'

      runner.step(message)

      expect(logger.step).toHaveBeenCalledWith('Release', `${message}\n`)
    })

    it('应该正确添加换行符', () => {
      const { logger } = requiredModule0
      const runner = new ReleaseRunner()

      runner.step('it')

      expect(logger.step).toHaveBeenCalledWith(
        'Release',
        expect.stringMatching(/\n$/),
      )
    })

    it('应该处理长消息', () => {
      const { logger } = requiredModule0
      const runner = new ReleaseRunner()
      const longMessage = 'x'.repeat(1000)

      runner.step(longMessage)

      expect(logger.step).toHaveBeenCalledWith('Release', `${longMessage}\n`)
    })
  })

  describe('ReleaseRunner run 方法基础测试', () => {
    it('run 方法应该存在', () => {
      const runner = new ReleaseRunner()
      expect(typeof runner.run).toBe('function')
    })

    it('run 方法应该是异步的', async () => {
      const runner = new ReleaseRunner()
      // 由于模拟环境的限制，检查函数是否返回 Promise 即可
      const result = runner.run()
      expect(result).toBeInstanceOf(Promise)
      await result
    })

    it('run 方法应该接受不同参数类型', async () => {
      await expect(new ReleaseRunner().run('patch')).resolves.toBeUndefined()
      await expect(new ReleaseRunner().run('1.0.0')).resolves.toBeUndefined()
      await expect(new ReleaseRunner().run()).resolves.toBeUndefined()
    })

    it('应该立即拒绝同一实例上的并发执行', async () => {
      const runner = new ReleaseRunner()
      const firstRun = runner.run()

      await expect(runner.run()).rejects.toMatchObject({
        code: 'PLUGIN_HOST_INVALID_STATE',
      })
      await firstRun
    })

    it('应该检测目标项目的包管理器并传递给应用数据', async () => {
      const { deepMerge, getPackageManager } = requiredModule0
      const resolvedConfig = deepMerge() as Config
      deepMerge.mockReturnValue({ ...resolvedConfig, cwd: '/it' })
      getPackageManager.mockResolvedValue('yarn')
      const runner = new ReleaseRunner({ cwd: '/it' })

      await runner.run()

      expect(getPackageManager).toHaveBeenCalledWith('/it')
      expect(runner.runHook).toHaveBeenCalledWith(
        'modifyAppData',
        expect.objectContaining({
          initialValue: expect.objectContaining({
            packageManager: 'yarn',
          }),
        }),
      )
    })

    it('应该优先使用根清单中的 packageManager 声明', async () => {
      const { deepMerge, getPackageManager, readJsonSync } = requiredModule0
      const resolvedConfig = deepMerge() as Config
      deepMerge.mockReturnValue({ ...resolvedConfig, cwd: '/it' })
      readJsonSync.mockReturnValue({
        name: 'it-package',
        packageManager: 'bun@1.3.3',
        version: '1.0.0',
      })
      const runner = new ReleaseRunner({ cwd: '/it' })

      await runner.run()

      expect(getPackageManager).not.toHaveBeenCalled()
      expect(runner.runHook).toHaveBeenCalledWith(
        'modifyAppData',
        expect.objectContaining({
          initialValue: expect.objectContaining({
            packageManager: 'bun',
            packageManagerVariant: 'bun',
          }),
        }),
      )
    })

    it('应该让显式构造选项覆盖配置文件', async () => {
      const { deepMerge } = requiredModule0
      const resolvedConfig = deepMerge() as Config
      deepMerge.mockClear()
      deepMerge.mockReturnValue({ ...resolvedConfig, cwd: '/it' })
      const runner = new ReleaseRunner({
        cwd: '/it',
        dryRun: true,
        git: { commit: false },
      })
      ;(
        runner as unknown as {
          userConfig: Config
        }
      ).userConfig = {
        dryRun: false,
        git: { commit: true },
      }

      await runner.run()

      const mergeArguments = deepMerge.mock.calls[0]
      expect(mergeArguments[2]).toEqual({
        dryRun: false,
        git: { commit: true },
      })
      expect(mergeArguments[3]).toEqual(
        expect.objectContaining({
          cwd: '/it',
          dryRun: true,
          git: { commit: false },
        }),
      )
    })

    it('应该拒绝配置 Hook 在初始化后切换工作目录', async () => {
      const { deepMerge } = requiredModule0
      const resolvedConfig = deepMerge() as Config
      deepMerge.mockReturnValue({ ...resolvedConfig, cwd: '/other' })
      const runner = new ReleaseRunner({ cwd: '/it' })

      await expect(runner.run()).rejects.toThrow()
      expect(requiredModule0.chalk.cyan).toHaveBeenCalledWith('/it')
      expect(requiredModule0.chalk.cyan).toHaveBeenCalledWith('/other')
      expect(runner.runHook).toHaveBeenCalledWith('onError', {
        args: {
          error: expect.anything(),
          stage: 'resolvingConfig',
        },
      })
      expect(runner.stage).toBe('failed')
    })
  })

  describe('ReleaseRunner 错误处理', () => {
    it('插件加载失败时不应该调用尚未注册完成的错误 Hook', async () => {
      const runner = new ReleaseRunner()
      const error = new Error('load failed')
      const load = (runner as unknown as { load: ReturnType<typeof vi.fn> })
        .load
      load.mockRejectedValue(error)

      await expect(runner.run()).rejects.toBe(error)
      expect(runner.runHook).not.toHaveBeenCalled()
      expect(runner.stage).toBe('failed')
    })

    it('应该处理文件系统访问错误', () => {
      const { pathExistsSync } = requiredModule0
      pathExistsSync.mockImplementation(() => {
        throw new Error('Permission denied')
      })

      expect(() => new ReleaseRunner()).toThrow()
    })

    it('应该处理 JSON 解析错误', () => {
      const { readJsonSync } = requiredModule0
      readJsonSync.mockImplementation(() => {
        throw new SyntaxError('Malformed JSON')
      })

      expect(() => new ReleaseRunner()).toThrow()
    })

    it('应该正确使用 chalk 来格式化错误消息', () => {
      const { pathExistsSync, chalk } = requiredModule0
      pathExistsSync.mockReturnValue(false)
      chalk.cyan.mockReturnValue('[styled-path]')

      expect(() => new ReleaseRunner({ cwd: '/it' })).toThrow()
      expect(chalk.cyan).toHaveBeenCalledWith('/it')
    })
  })

  describe('ReleaseRunner 配置验证和处理', () => {
    it('应该接受各种配置组合', () => {
      const configs = [
        {},
        { cwd: '/it' },
        { presets: ['preset1'] },
        { plugins: ['plugin1'] },
        { git: { requireClean: false } },
        { npm: { confirm: false } },
        { github: { release: false } },
      ]

      configs.forEach(config => {
        expect(() => new ReleaseRunner(config)).not.toThrow()
      })
    })

    it('应该正确处理 presets 数组', () => {
      const { PluginHost } = requiredModule1

      // 空数组
      new ReleaseRunner({ presets: [] })
      expect(PluginHost).toHaveBeenLastCalledWith(
        expect.objectContaining({
          presets: [expect.stringMatching(/internal/)],
        }),
        expect.any(Object),
      )

      // 单个 preset
      new ReleaseRunner({ presets: ['single-preset'] })
      expect(PluginHost).toHaveBeenLastCalledWith(
        expect.objectContaining({
          presets: [expect.stringMatching(/internal/), 'single-preset'],
        }),
        expect.any(Object),
      )

      // 多个 presets
      new ReleaseRunner({ presets: ['preset1', 'preset2', 'preset3'] })
      expect(PluginHost).toHaveBeenLastCalledWith(
        expect.objectContaining({
          presets: [
            expect.stringMatching(/internal/),
            'preset1',
            'preset2',
            'preset3',
          ],
        }),
        expect.any(Object),
      )
    })

    it('应该正确处理 plugins 数组', () => {
      const { PluginHost } = requiredModule1

      // 空数组
      new ReleaseRunner({ plugins: [] })
      expect(PluginHost).toHaveBeenLastCalledWith(
        expect.objectContaining({
          plugins: [],
        }),
        expect.any(Object),
      )

      // 多个 plugins
      new ReleaseRunner({ plugins: ['plugin1', 'plugin2'] })
      expect(PluginHost).toHaveBeenLastCalledWith(
        expect.objectContaining({
          plugins: ['plugin1', 'plugin2'],
        }),
        expect.any(Object),
      )
    })
  })

  describe('ReleaseRunner 属性和方法验证', () => {
    it('应该有所有必需的公共属性', () => {
      const runner = new ReleaseRunner()

      expect('appData' in runner).toBe(true)
      expect(() => runner.appData).toThrow()
      expect('config' in runner).toBe(true)
    })

    it('应该有所有必需的公共方法', () => {
      const runner = new ReleaseRunner()

      expect(typeof runner.step).toBe('function')
      expect(typeof runner.run).toBe('function')
      expect(typeof runner.runHook).toBe('function')
    })

    it('appData 应该在准备完成后才可读取', () => {
      const runner = new ReleaseRunner()

      expect(() => runner.appData).toThrow(
        expect.objectContaining({ code: 'PLUGIN_HOST_INVALID_STATE' }),
      )
    })
  })

  describe('ReleaseRunner 边界条件测试', () => {
    it('应该处理各种路径格式', () => {
      const paths = [
        '/absolute/path',
        './relative/path',
        '../parent/path',
        '/path with spaces',
        '/path/with/unicode/测试',
      ]

      paths.forEach(path => {
        expect(() => new ReleaseRunner({ cwd: path })).not.toThrow()
      })
    })

    it('应该处理特殊的 package.json 内容', () => {
      const { readJsonSync } = requiredModule0
      const specialPackages = [
        { name: 'normal-package', version: '1.0.0' },
        { name: '@scoped/package', version: '2.1.3' },
        { name: '测试包', version: '1.0.0' },
        { name: 'package-with-emoji-🚀', version: '1.0.0' },
        {
          name: 'complex-package',
          version: '1.0.0-beta.1',
          description: 'A complex package with many fields',
          keywords: ['it', 'complex'],
        },
      ]

      specialPackages.forEach(pkg => {
        readJsonSync.mockReturnValue(pkg)
        const runner = new ReleaseRunner()
        expect(runner['_initialAppData'].projectPkg).toEqual(pkg)
      })
    })

    it('应该处理大型配置对象', () => {
      const largeConfig: Config = {
        presets: Array.from({ length: 50 }, (_, i) => `preset-${i}`),
        plugins: Array.from({ length: 50 }, (_, i) => `plugin-${i}`),
        git: {
          requireClean: true,
          changelog: {
            filename: 'CHANGELOG.md',
            preset: 'angular',
          },
        },
        npm: {
          confirm: true,
          publishArgs: ['--access', 'public'],
        },
      }

      expect(() => new ReleaseRunner(largeConfig)).not.toThrow()
    })
  })
})
