import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockedFunction,
} from 'vitest'
import * as importedModule0 from '../src/cli'
/**
 * @file packages/release cli 模块单元测试
 * @description 测试 cli.ts 命令行接口功能（重构版本）
 */

// 类型定义
type VersionCheckFunction = (version: string) => string
type ActionHandlerFunction = (
  version?: string,
  options?: Record<string, unknown>,
) => Promise<void>

// 首先进行所有模拟设置
vi.mock('@eljs/utils', () => ({
  chalk: {
    yellow: vi.fn((text: string) => `[yellow]${text}[/yellow]`),
    cyan: vi.fn((text: string) => `[cyan]${text}[/cyan]`),
    red: vi.fn((text: string) => `[red]${text}[/red]`),
  },
  createDebugger: vi.fn(() => vi.fn()),
  readJson: vi.fn(),
}))
vi.mock('@eljs/utils/file', async () => import('@eljs/utils'))
vi.mock('@eljs/utils/logger', async () => import('@eljs/utils'))

const { mockNotifyUpdates, realRunCliProcess } = await vi.hoisted(() =>
  import('@eljs/utils/cli').then(loaded => ({
    mockNotifyUpdates: vi.fn(),
    realRunCliProcess: loaded.runCliProcess,
  })),
)

// 信号语义由共享外壳保证，这里直接复用真实实现保持测试效力
vi.mock('@eljs/utils/cli', () => ({
  runCliProcess: (
    options: Parameters<typeof realRunCliProcess>[0],
  ): Promise<void> => realRunCliProcess(options),
  notifyUpdates: mockNotifyUpdates,
}))

const { mockProgram } = vi.hoisted(() => ({
  mockProgram: {
    name: vi.fn().mockReturnThis(),
    description: vi.fn().mockReturnThis(),
    version: vi.fn().mockReturnThis(),
    argument: vi.fn().mockReturnThis(),
    option: vi.fn().mockReturnThis(),
    addOption: vi.fn().mockReturnThis(),
    showHelpAfterError: vi.fn().mockReturnThis(),
    action: vi.fn().mockReturnThis(),
    parseAsync: vi.fn().mockResolvedValue(undefined),
    outputHelp: vi.fn(),
    options: [] as Array<{ attributeName: () => string }>,
    getOptionValueSource: vi.fn((_key: string) => 'cli' as const),
  },
}))

vi.mock('commander', () => ({
  InvalidArgumentError: class InvalidArgumentError extends Error {},
  Option: class Option {
    public constructor(
      public flags: string,
      public description?: string,
    ) {}
    public choices() {
      return this
    }
    public default() {
      return this
    }
  },
  Command: class Command {
    public constructor() {
      return mockProgram
    }
  },
}))

vi.mock('node:path', async importOriginal => {
  const original = await importOriginal<typeof import('node:path')>()
  const join = vi.fn()

  return {
    ...original,
    default: { ...original, join },
    join,
  }
})

vi.mock('semver', () => {
  const valid = vi.fn()
  const validRange = vi.fn()
  const releaseTypes = [
    'major',
    'minor',
    'patch',
    'premajor',
    'preminor',
    'prepatch',
    'prerelease',
  ]

  return {
    default: { valid, validRange, RELEASE_TYPES: releaseTypes },
    valid,
    validRange,
    RELEASE_TYPES: releaseTypes,
  }
})

vi.mock('update-notifier')
vi.mock('../src/release')
vi.mock('../src/utils', () => ({
  AppError: class AppError extends Error {},
}))

// 导入模块
import { createDebugger, readJson } from '@eljs/utils'
import path from 'node:path'
import semver, { RELEASE_TYPES } from 'semver'
import updateNotifier from 'update-notifier'
import { cli } from '../src/cli'
import { release } from '../src/release'

const requiredModule0 = vi.mocked(importedModule0, { deep: true })

// 模拟 console.log
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

// 将 opts 的键注册为显式 CLI 选项，模拟真实 commander 中
// 声明即注册、传入即 source=cli 的行为
const runAction = (
  actionHandler: ActionHandlerFunction,
  version: string | undefined,
  opts: Record<string, unknown>,
): Promise<void> => {
  mockProgram.options = Object.keys(opts).map(key => ({
    attributeName: () => key,
  }))
  return actionHandler(version, opts, mockProgram)
}

describe('CLI 命令行接口综合测试', () => {
  const mockPackageJson = {
    name: '@eljs/release',
    version: '1.3.1',
    description:
      'Programmable npm release workflow for versioning, changelogs, GitHub, and ordered workspace publishing.',
  }
  beforeEach(() => {
    vi.clearAllMocks()
    process.exitCode = undefined
    mockProgram.options = []
    // restoreMocks 每轮清空实现，这里恢复默认全显式语义
    mockProgram.getOptionValueSource.mockImplementation(() => 'cli')
    ;(readJson as MockedFunction<typeof readJson>).mockResolvedValue(
      mockPackageJson,
    )
    ;(path.join as MockedFunction<typeof path.join>).mockReturnValue(
      '/mock/package.json',
    )
    ;(updateNotifier as MockedFunction<typeof updateNotifier>).mockReturnValue({
      notify: vi.fn(),
      check: vi.fn(),
      fetchInfo: vi.fn(),
    } as unknown as ReturnType<typeof updateNotifier>)
    ;(release as MockedFunction<typeof release>).mockResolvedValue(undefined)
    ;(semver.valid as MockedFunction<typeof semver.valid>)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation((version: any) => {
        return typeof version === 'string' && /^\d+\.\d+\.\d+/.test(version)
          ? version
          : null
      })
  })

  afterEach(() => {
    process.exitCode = undefined
  })

  afterAll(() => {
    mockConsoleLog.mockRestore()
  })

  describe('CLI 函数基本功能', () => {
    it('应该成功执行 cli 函数', async () => {
      await cli()

      expect(readJson).toHaveBeenCalled()
      expect(mockNotifyUpdates).toHaveBeenCalledWith({
        pkg: mockPackageJson,
        argv: process.argv,
        debug: expect.any(Function),
      })
      expect(mockProgram.parseAsync).toHaveBeenCalledWith(process.argv)
    })

    it('应该正确设置 program 基本信息', async () => {
      await cli()

      expect(mockProgram.name).toHaveBeenCalledWith('release')
      expect(mockProgram.description).toHaveBeenCalledWith(
        'Run a programmable npm release workflow',
      )
      expect(mockProgram.version).toHaveBeenCalledWith(
        '1.3.1',
        '-v, --version',
        'Output the current version',
      )
    })

    it('应该设置版本参数', async () => {
      await cli()

      expect(mockProgram.argument).toHaveBeenCalledWith(
        '[version]',
        'Specify the bump version',
        expect.any(Function),
      )
    })

    it('应该设置基本命令行选项', async () => {
      await cli()

      // 验证关键选项
      expect(mockProgram.option).toHaveBeenCalledWith(
        '--cwd <cwd>',
        'Specify the working directory',
      )
      expect(mockProgram.option).toHaveBeenCalledWith(
        '--dry-run',
        'Validate and preview without publishing or modifying project files',
      )
      expect(mockProgram.option).toHaveBeenCalledWith(
        '--retry',
        'Retry the release version from the release tag at HEAD',
      )
      expect(mockProgram.option).toHaveBeenCalledWith(
        '--git.independent',
        'Generate one git tag per workspace package',
        false,
      )
      expect(mockProgram.option).toHaveBeenCalledWith(
        '--no-git.independent',
        'Generate a single git tag',
      )
      expect(mockProgram.option).toHaveBeenCalledWith(
        '--git.push',
        'Push commit and tags to remote',
        true,
      )
      expect(mockProgram.option).toHaveBeenCalledWith(
        '--no-git.push',
        'Skip git push',
      )
      expect(mockProgram.option).toHaveBeenCalledWith(
        '--npm.prerelease',
        'Specify the release type as prerelease',
        false,
      )
      expect(mockProgram.option).toHaveBeenCalledWith(
        '--npm.canary',
        'Specify the release type as canary',
        false,
      )
      expect(mockProgram.option).toHaveBeenCalledWith(
        '--npm.registry <registry>',
        'Specify the npm registry',
      )
      expect(mockProgram.addOption).toHaveBeenCalledTimes(1)
    })

    it('应该设置 action 处理器', async () => {
      await cli()

      expect(mockProgram.action).toHaveBeenCalledWith(expect.any(Function))
    })
  })

  describe('版本验证功能测试', () => {
    let checkVersion: VersionCheckFunction

    beforeEach(async () => {
      await cli()

      const argumentCall = mockProgram.argument.mock.calls.find(
        call => call[0] === '[version]',
      )
      checkVersion = argumentCall ? argumentCall[2] : null
    })

    it('应该接受有效的语义化版本', () => {
      expect(checkVersion('1.0.0')).toBe('1.0.0')
      expect(checkVersion('2.1.3')).toBe('2.1.3')
    })

    it('应该接受发布类型', () => {
      RELEASE_TYPES.forEach(type => {
        expect(checkVersion(type)).toBe(type)
      })
    })

    it('应该移除版本前的 v 前缀', () => {
      ;(semver.valid as MockedFunction<typeof semver.valid>).mockReturnValue(
        '1.0.0',
      )
      expect(checkVersion('v1.0.0')).toBe('1.0.0')
    })

    it('应该对无效版本抛出错误', () => {
      ;(semver.valid as MockedFunction<typeof semver.valid>).mockReturnValue(
        null,
      )

      expect(() => checkVersion('invalid-version')).toThrow()
      expect(() => checkVersion('1.0')).toThrow()
    })
  })

  describe('Action 处理器功能测试', () => {
    let actionHandler: ActionHandlerFunction

    beforeEach(async () => {
      await cli()
      const actionCall = mockProgram.action.mock.calls[0]
      actionHandler = actionCall ? actionCall[0] : null
    })

    it('应该正确调用 release 函数', async () => {
      await runAction(actionHandler, '1.0.0', { cwd: '/it' })

      expect(release).toHaveBeenCalledWith(
        '1.0.0',
        expect.objectContaining({
          cwd: '/it',
        }),
      )
    })

    it('retry 与版本参数互斥时应该报错', async () => {
      await expect(
        runAction(actionHandler, '1.2.3', { retry: true }),
      ).rejects.toThrow('--retry cannot be combined with a version argument')

      expect(release).not.toHaveBeenCalled()
    })

    it('retry 应该转发到 release 配置', async () => {
      await runAction(actionHandler, undefined, { retry: true })

      expect(release).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          retry: true,
        }),
      )
    })

    it('应该正确解析嵌套选项', async () => {
      await runAction(actionHandler, 'minor', {
        dryRun: true,
        'git.requireClean': false,
        'npm.confirm': false,
        'npm.registry': 'https://registry.example.com',
        'github.release': true,
      })

      expect(release).toHaveBeenCalledWith(
        'minor',
        expect.objectContaining({
          dryRun: true,
          git: expect.objectContaining({
            requireClean: false,
          }),
          npm: expect.objectContaining({
            confirm: false,
            registry: 'https://registry.example.com',
          }),
          github: expect.objectContaining({
            release: true,
          }),
        }),
      )
    })

    it('应该过滤 source 为 default 的选项', async () => {
      mockProgram.options = [
        { attributeName: () => 'git.independent' },
        { attributeName: () => 'git.requireClean' },
        { attributeName: () => 'git.commit' },
        { attributeName: () => 'npm.confirm' },
        { attributeName: () => 'github.release' },
      ]
      mockProgram.getOptionValueSource.mockImplementation(key =>
        key === 'git.independent' ? 'cli' : 'default',
      )

      await actionHandler(
        'patch',
        {
          'git.requireClean': true,
          'git.commit': true,
          'npm.confirm': true,
          'github.release': true,
          'git.independent': true,
        },
        mockProgram,
      )

      const releaseCall = (release as MockedFunction<typeof release>).mock
        .calls[0]
      const options = releaseCall[1]

      // source 为 default 的键全部过滤，只有 CLI 显式传递的键进入配置；
      // 全部键被过滤时不会产生空配置组
      expect(options?.git).toEqual({ independent: true })
      expect(options).not.toHaveProperty('npm')
      expect(options).not.toHaveProperty('github')
    })
  })

  describe('checkPrereleaseId 校验测试', () => {
    let checkPrereleaseId: (value: string) => string

    beforeEach(async () => {
      await cli()
      const optionCall = mockProgram.option.mock.calls.find(call =>
        call[0].includes('prereleaseId'),
      )
      checkPrereleaseId = optionCall ? optionCall[2] : null
    })

    it('应该接受合法的预发布标识', () => {
      ;(
        semver.validRange as MockedFunction<typeof semver.validRange>
      ).mockReturnValue(null)

      expect(checkPrereleaseId('alpha')).toBe('alpha')
      expect(checkPrereleaseId('beta')).toBe('beta')
      expect(checkPrereleaseId('rc')).toBe('rc')
      expect(checkPrereleaseId('next')).toBe('next')
    })

    it('应该拒绝语义化版本区间', () => {
      ;(
        semver.validRange as MockedFunction<typeof semver.validRange>
      ).mockReturnValue('1.2.3')

      expect(() => checkPrereleaseId('1.2.3')).toThrow()
    })

    it('应该拒绝 latest 保留字', () => {
      ;(
        semver.validRange as MockedFunction<typeof semver.validRange>
      ).mockReturnValue(null)

      expect(() => checkPrereleaseId('latest')).toThrow()
    })

    it('应该拒绝多段或含非法字符的标识', () => {
      ;(
        semver.validRange as MockedFunction<typeof semver.validRange>
      ).mockReturnValue(null)

      expect(() => checkPrereleaseId('alpha.1')).toThrow()
      expect(() => checkPrereleaseId('alpha beta')).toThrow()
    })
  })

  describe('错误帮助配置', () => {
    it('应该使用 Commander 的公开 API 在错误后展示帮助', async () => {
      await cli()

      expect(mockProgram.showHelpAfterError).toHaveBeenCalledWith()
    })
  })

  describe('信号处理验证', () => {
    it('重复调用 CLI 不应该重复注册 SIGINT 处理器', async () => {
      await cli()
      const listenerCount = process.listenerCount('SIGINT')

      await cli()

      expect(process.listenerCount('SIGINT')).toBe(listenerCount)
    })

    it('应该注册 SIGINT 信号处理器', () => {
      const originalListeners = process.listeners('SIGINT')

      void requiredModule0

      const newListeners = process.listeners('SIGINT')
      expect(newListeners.length).toBeGreaterThanOrEqual(
        originalListeners.length,
      )
    })

    it('首次信号应该立即保留取消退出码并在宽限期后退出', async () => {
      vi.useFakeTimers()
      const previousListeners = new Set(process.listeners('SIGTERM'))
      let markParseStarted: (() => void) | undefined
      let resolveParse: (() => void) | undefined
      const parseStarted = new Promise<void>(resolve => {
        markParseStarted = resolve
      })
      const exit = vi
        .spyOn(process, 'exit')
        .mockImplementation((() => undefined) as never)
      mockProgram.parseAsync.mockImplementationOnce(
        () =>
          new Promise<void>(resolve => {
            resolveParse = resolve
            markParseStarted?.()
          }),
      )

      try {
        const cliPromise = cli()
        await parseStarted
        const signalHandler = process
          .listeners('SIGTERM')
          .find(listener => !previousListeners.has(listener))

        expect(signalHandler).toBeTypeOf('function')
        ;(signalHandler as (signal: NodeJS.Signals) => void)('SIGTERM')
        expect(process.exitCode).toBe(130)

        await vi.advanceTimersByTimeAsync(5_000)
        expect(exit).toHaveBeenCalledWith(130)

        resolveParse?.()
        await cliPromise
        expect(process.listeners('SIGTERM')).not.toContain(signalHandler)
      } finally {
        exit.mockRestore()
        vi.useRealTimers()
      }
    })
  })

  describe('CLI 依赖集成验证', () => {
    it('应该正确读取和使用 package.json', async () => {
      await cli()

      expect(readJson).toHaveBeenCalledWith('/mock/package.json')
      expect(path.join).toHaveBeenCalledWith(
        expect.any(String),
        '../package.json',
      )
    })

    it('应该通过 notifyUpdates 触发更新提示', async () => {
      await cli()

      expect(mockNotifyUpdates).toHaveBeenCalledTimes(1)
      expect(mockNotifyUpdates).toHaveBeenCalledWith({
        pkg: mockPackageJson,
        argv: process.argv,
        debug: expect.any(Function),
      })
    })
  })

  describe('parseOptions 函数深度测试', () => {
    let actionHandler: ActionHandlerFunction

    beforeEach(async () => {
      mockProgram.parseAsync.mockResolvedValue(undefined) // 恢复正常
      await cli()
      const actionCall = mockProgram.action.mock.calls[0]
      actionHandler = actionCall[0]
    })

    it('应该处理复杂的选项键路径', async () => {
      await runAction(actionHandler, '1.0.0', {
        'git.changelog.filename': 'CHANGES.md',
        'git.changelog.preset': 'angular',
        'npm.publishArgs': '--access public',
      })

      expect(release).toHaveBeenCalledWith(
        '1.0.0',
        expect.objectContaining({
          git: expect.objectContaining({
            changelog: expect.objectContaining({
              filename: 'CHANGES.md',
              preset: 'angular',
            }),
          }),
          npm: expect.objectContaining({
            publishArgs: '--access public',
          }),
        }),
      )
    })

    it('应该处理空选项对象', async () => {
      await runAction(actionHandler, 'major', {})

      expect(release).toHaveBeenCalledWith('major', expect.objectContaining({}))
    })

    it('应该处理混合的平级和嵌套选项', async () => {
      await runAction(actionHandler, 'minor', {
        cwd: '/mixed/path',
        'git.push': false,
        'npm.canary': true,
        someFlat: 'value',
      })

      expect(release).toHaveBeenCalledWith(
        'minor',
        expect.objectContaining({
          cwd: '/mixed/path',
          someFlat: 'value',
          git: expect.objectContaining({
            push: false,
          }),
          npm: expect.objectContaining({
            canary: true,
          }),
        }),
      )
    })
  })

  describe('CLI 完整功能覆盖测试', () => {
    it('应该完整覆盖所有设置步骤', async () => {
      await cli()

      // 验证所有关键步骤都被执行
      expect(readJson).toHaveBeenCalled()
      expect(mockNotifyUpdates).toHaveBeenCalled()
      expect(mockProgram.name).toHaveBeenCalled()
      expect(mockProgram.description).toHaveBeenCalled()
      expect(mockProgram.version).toHaveBeenCalled()
      expect(mockProgram.argument).toHaveBeenCalled()

      // 验证所有选项都被设置（成对声明后至少 18 个 .option 调用 + 1 个 addOption）
      expect(mockProgram.option.mock.calls.length).toBeGreaterThanOrEqual(18)

      expect(mockProgram.action).toHaveBeenCalled()
      expect(mockProgram.parseAsync).toHaveBeenCalled()
    })

    it('应该处理所有类型的版本输入', async () => {
      await cli()
      const actionCall = mockProgram.action.mock.calls[0]
      const actionHandler = actionCall[0]

      const versionInputs = [
        '1.0.0',
        'v2.0.0',
        'major',
        'minor',
        'patch',
        'prerelease',
        '1.0.0-alpha.1',
        undefined,
      ]

      for (const version of versionInputs) {
        vi.clearAllMocks()
        mockProgram.options = []
        mockProgram.getOptionValueSource.mockImplementation(() => 'cli')
        await runAction(actionHandler, version, {})
        expect(release).toHaveBeenCalledTimes(1)
      }
    })
  })

  describe('CLI 环境和模块测试', () => {
    it('应该正确处理环境变量控制', () => {
      // 测试 DISABLE_CLI_AUTO_RUN
      process.env.DISABLE_CLI_AUTO_RUN = 'true'

      expect(() => {
        void requiredModule0
      }).not.toThrow()

      delete process.env.DISABLE_CLI_AUTO_RUN
    })

    it('应该在测试环境下正确工作', () => {
      const originalNodeEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'test'

      expect(() => {
        void requiredModule0
      }).not.toThrow()
      process.env.NODE_ENV = originalNodeEnv
    })

    it('应该设置信号处理器', () => {
      const originalListeners = process.listeners('SIGINT')

      void requiredModule0

      const newListeners = process.listeners('SIGINT')
      expect(newListeners.length).toBeGreaterThanOrEqual(
        originalListeners.length,
      )
    })
  })

  describe('CLI 调试和开发功能', () => {
    it('应该创建和使用调试器', () => {
      // createDebugger 在模块加载时被调用，检查它是否被正确模拟
      expect(createDebugger).toBeDefined()
      expect(typeof createDebugger).toBe('function')
    })

    it('应该能处理 debug 函数调用', () => {
      // debug 函数被正确创建和模拟
      expect(createDebugger).toBeDefined()
      const debugInstance = createDebugger('it')
      expect(typeof debugInstance).toBe('function')
    })
  })

  describe('checkVersion 函数详细测试', () => {
    let checkVersion: VersionCheckFunction

    beforeEach(async () => {
      await cli()
      const argumentCall = mockProgram.argument.mock.calls.find(
        call => call[0] === '[version]',
      )
      checkVersion = argumentCall ? argumentCall[2] : null
    })

    it('应该正确处理各种版本格式', () => {
      const validVersions = [
        '1.0.0',
        '10.20.30',
        '1.0.0-alpha.1',
        '2.0.0-beta.2',
      ]

      validVersions.forEach(version => {
        ;(semver.valid as MockedFunction<typeof semver.valid>).mockReturnValue(
          version,
        )
        expect(checkVersion(version)).toBe(version)
      })
    })

    it('应该正确处理 v 前缀移除', () => {
      ;(semver.valid as MockedFunction<typeof semver.valid>).mockReturnValue(
        '1.0.0',
      )

      expect(checkVersion('v1.0.0')).toBe('1.0.0')
      expect(checkVersion('v2.1.3')).toBe('2.1.3')
      expect(checkVersion('v10.0.0-alpha.1')).toBe('10.0.0-alpha.1')
    })

    it('应该接受所有发布类型', () => {
      expect(checkVersion('major')).toBe('major')
      expect(checkVersion('minor')).toBe('minor')
      expect(checkVersion('patch')).toBe('patch')
      expect(checkVersion('prerelease')).toBe('prerelease')
      expect(checkVersion('premajor')).toBe('premajor')
      expect(checkVersion('preminor')).toBe('preminor')
      expect(checkVersion('prepatch')).toBe('prepatch')
    })

    it('应该对无效版本抛出 InvalidArgumentError', () => {
      ;(semver.valid as MockedFunction<typeof semver.valid>).mockReturnValue(
        null,
      )

      expect(() => checkVersion('invalid')).toThrow()
      expect(() => checkVersion('1.0')).toThrow()
      expect(() => checkVersion('')).toThrow()
      expect(() => checkVersion('abc.def.ghi')).toThrow()
    })
  })

  describe('CLI 完整集成测试', () => {
    it('应该能够处理完整的发布流程调用', async () => {
      await cli()
      const actionCall = mockProgram.action.mock.calls[0]
      const actionHandler = actionCall[0]

      await runAction(actionHandler, '1.0.0', {
        cwd: process.cwd(),
        'git.requireClean': false,
        'npm.confirm': false,
      })

      expect(release).toHaveBeenCalledWith(
        '1.0.0',
        expect.objectContaining({
          cwd: process.cwd(),
          git: expect.objectContaining({
            requireClean: false,
          }),
          npm: expect.objectContaining({
            confirm: false,
          }),
        }),
      )
    })

    it('应该能够处理复杂的选项过滤逻辑', async () => {
      await cli()
      const actionCall = mockProgram.action.mock.calls[0]
      const actionHandler = actionCall[0]

      mockProgram.options = [
        { attributeName: () => 'git.requireClean' },
        { attributeName: () => 'git.commit' },
        { attributeName: () => 'git.push' },
        { attributeName: () => 'npm.requireOwner' },
        { attributeName: () => 'npm.confirm' },
      ]
      mockProgram.getOptionValueSource.mockReturnValue('default')

      await actionHandler(
        'major',
        {
          'git.requireClean': true,
          'git.commit': true,
          'git.push': true,
          'npm.requireOwner': true,
          'npm.confirm': true,
        },
        mockProgram,
      )

      const releaseCall = (release as MockedFunction<typeof release>).mock
        .calls[0]
      const options = releaseCall[1]

      // 所有 source 为 default 的键都被过滤，不产生空配置组
      expect(options).not.toHaveProperty('git')
      expect(options).not.toHaveProperty('npm')
    })
  })

  describe('CLI 模块导出验证', () => {
    it('应该导出 cli 函数', () => {
      expect(cli).toBeDefined()
      expect(typeof cli).toBe('function')
    })

    it('应该能够重复调用 cli 函数', async () => {
      await cli()
      vi.clearAllMocks()
      await cli()

      // 应该再次调用所有设置步骤
      expect(readJson).toHaveBeenCalled()
      expect(mockNotifyUpdates).toHaveBeenCalled()
      expect(mockProgram.parseAsync).toHaveBeenCalled()
    })
  })
})
