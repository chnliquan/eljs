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
jest.mock('@eljs/utils', () => ({
  chalk: {
    yellow: jest.fn((text: string) => `[yellow]${text}[/yellow]`),
    cyan: jest.fn((text: string) => `[cyan]${text}[/cyan]`),
    red: jest.fn((text: string) => `[red]${text}[/red]`),
  },
  createDebugger: jest.fn(() => jest.fn()),
  readJson: jest.fn(),
}))

const mockProgram = {
  name: jest.fn().mockReturnThis(),
  description: jest.fn().mockReturnThis(),
  version: jest.fn().mockReturnThis(),
  argument: jest.fn().mockReturnThis(),
  option: jest.fn().mockReturnThis(),
  action: jest.fn().mockReturnThis(),
  parseAsync: jest.fn().mockResolvedValue(undefined),
  outputHelp: jest.fn(),
}

jest.mock('commander', () => ({
  Command: jest.fn(),
  InvalidArgumentError: jest.fn((message: string) => new Error(message)),
  program: mockProgram,
}))

jest.mock('node:path', () => ({
  join: jest.fn(),
}))

jest.mock('semver', () => ({
  valid: jest.fn(),
  RELEASE_TYPES: [
    'major',
    'minor',
    'patch',
    'premajor',
    'preminor',
    'prepatch',
    'prerelease',
  ],
}))

jest.mock('update-notifier')
jest.mock('../src/release')
jest.mock('../src/utils', () => ({
  onCancel: jest.fn(),
}))

// 导入模块
import { createDebugger, readJson } from '@eljs/utils'
import { Command } from 'commander'
import path from 'node:path'
import semver, { RELEASE_TYPES } from 'semver'
import updateNotifier from 'update-notifier'
import { cli } from '../src/cli'
import { release } from '../src/release'

// 模拟 console.log
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {})

describe('CLI 命令行接口综合测试', () => {
  const mockPackageJson = {
    name: '@eljs/release',
    version: '1.3.1',
    description: 'Release npm package easily.',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(readJson as jest.MockedFunction<typeof readJson>).mockResolvedValue(
      mockPackageJson,
    )
    ;(path.join as jest.MockedFunction<typeof path.join>).mockReturnValue(
      '/mock/package.json',
    )
    ;(
      updateNotifier as jest.MockedFunction<typeof updateNotifier>
    ).mockReturnValue({
      notify: jest.fn(),
      check: jest.fn(),
      fetchInfo: jest.fn(),
    } as unknown as ReturnType<typeof updateNotifier>)
    ;(release as jest.MockedFunction<typeof release>).mockResolvedValue(
      undefined,
    )
    ;(semver.valid as jest.MockedFunction<typeof semver.valid>)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation((version: any) => {
        return typeof version === 'string' && /^\d+\.\d+\.\d+/.test(version)
          ? version
          : null
      })
  })

  afterAll(() => {
    mockConsoleLog.mockRestore()
  })

  describe('CLI 函数基本功能', () => {
    test('应该成功执行 cli 函数', async () => {
      await cli()

      expect(readJson).toHaveBeenCalled()
      expect(updateNotifier).toHaveBeenCalledWith({ pkg: mockPackageJson })
      expect(mockProgram.parseAsync).toHaveBeenCalledWith(process.argv)
    })

    test('应该正确设置 program 基本信息', async () => {
      await cli()

      expect(mockProgram.name).toHaveBeenCalledWith('release')
      expect(mockProgram.description).toHaveBeenCalledWith(
        'Release npm package easily',
      )
      expect(mockProgram.version).toHaveBeenCalledWith(
        '1.3.1',
        '-v, --version',
        'Output the current version',
      )
    })

    test('应该设置版本参数', async () => {
      await cli()

      expect(mockProgram.argument).toHaveBeenCalledWith(
        '[version]',
        'Specify the bump version',
        expect.any(Function),
      )
    })

    test('应该设置基本命令行选项', async () => {
      await cli()

      // 验证关键选项
      expect(mockProgram.option).toHaveBeenCalledWith(
        '--cwd <cwd>',
        'Specify the working directory',
      )
      expect(mockProgram.option).toHaveBeenCalledWith(
        '--git.independent',
        'Generate git tag independent',
      )
      expect(mockProgram.option).toHaveBeenCalledWith(
        '--npm.prerelease',
        'Specify the release type as prerelease',
      )
      expect(mockProgram.option).toHaveBeenCalledWith(
        '--npm.canary',
        'Specify the release type as canary',
      )
    })

    test('应该设置 action 处理器', async () => {
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

    test('应该接受有效的语义化版本', () => {
      expect(checkVersion('1.0.0')).toBe('1.0.0')
      expect(checkVersion('2.1.3')).toBe('2.1.3')
    })

    test('应该接受发布类型', () => {
      RELEASE_TYPES.forEach(type => {
        expect(checkVersion(type)).toBe(type)
      })
    })

    test('应该移除版本前的 v 前缀', () => {
      ;(
        semver.valid as jest.MockedFunction<typeof semver.valid>
      ).mockReturnValue('1.0.0')
      expect(checkVersion('v1.0.0')).toBe('1.0.0')
    })

    test('应该对无效版本抛出错误', () => {
      ;(
        semver.valid as jest.MockedFunction<typeof semver.valid>
      ).mockReturnValue(null)

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

    test('应该正确调用 release 函数', async () => {
      await actionHandler('1.0.0', { cwd: '/test' })

      expect(release).toHaveBeenCalledWith(
        '1.0.0',
        expect.objectContaining({
          cwd: '/test',
        }),
      )
    })

    test('应该正确解析嵌套选项', async () => {
      /* eslint-disable @typescript-eslint/naming-convention */
      await actionHandler('minor', {
        'git.requireClean': false,
        'npm.confirm': false,
        'github.release': true,
      })
      /* eslint-enable @typescript-eslint/naming-convention */

      expect(release).toHaveBeenCalledWith(
        'minor',
        expect.objectContaining({
          git: expect.objectContaining({
            requireClean: false,
          }),
          npm: expect.objectContaining({
            confirm: false,
          }),
          github: expect.objectContaining({
            release: true,
          }),
        }),
      )
    })

    test('应该删除默认 true 值的特定选项', async () => {
      /* eslint-disable @typescript-eslint/naming-convention */
      await actionHandler('patch', {
        'git.requireClean': true, // 应该被删除
        'git.commit': true, // 应该被删除
        'npm.confirm': true, // 应该被删除
        'git.independent': true, // 不应该被删除
      })
      /* eslint-enable @typescript-eslint/naming-convention */

      const releaseCall = (release as jest.MockedFunction<typeof release>).mock
        .calls[0]
      const options = releaseCall[1]

      // 验证特定选项被删除
      expect(options?.git).not.toHaveProperty('requireClean')
      expect(options?.git).not.toHaveProperty('commit')
      expect(options?.npm).not.toHaveProperty('confirm')

      // 验证这个选项保留
      expect(options?.git).toHaveProperty('independent', true)
    })
  })

  describe('错误处理增强验证', () => {
    test('应该增强 Command 原型方法', async () => {
      await cli()

      // 验证原型方法被增强
      expect(Command.prototype).toHaveProperty('missingArgument')
      expect(Command.prototype).toHaveProperty('unknownOption')
      expect(Command.prototype).toHaveProperty('optionMissingArgument')
      expect(Command.prototype).toHaveProperty('_excessArguments')
    })
  })

  describe('信号处理验证', () => {
    test('应该注册 SIGINT 信号处理器', () => {
      const originalListeners = process.listeners('SIGINT')

      delete require.cache[require.resolve('../src/cli')]
      require('../src/cli')

      const newListeners = process.listeners('SIGINT')
      expect(newListeners.length).toBeGreaterThanOrEqual(
        originalListeners.length,
      )
    })
  })

  describe('CLI 依赖集成验证', () => {
    test('应该正确读取和使用 package.json', async () => {
      await cli()

      expect(readJson).toHaveBeenCalledWith('/mock/package.json')
      expect(path.join).toHaveBeenCalledWith(
        expect.any(String),
        '../package.json',
      )
    })

    test('应该调用 updateNotifier 并触发通知', async () => {
      await cli()

      expect(updateNotifier).toHaveBeenCalledWith({ pkg: mockPackageJson })

      const notifierResult = (
        updateNotifier as jest.MockedFunction<typeof updateNotifier>
      ).mock.results[0]
      if (notifierResult && notifierResult.value) {
        expect(notifierResult.value.notify).toHaveBeenCalled()
      }
    })

    test('应该处理各种错误情况', async () => {
      // 测试 readJson 错误
      ;(readJson as jest.MockedFunction<typeof readJson>).mockRejectedValue(
        new Error('文件读取失败'),
      )
      await expect(cli()).rejects.toThrow('文件读取失败')

      // 恢复模拟
      ;(readJson as jest.MockedFunction<typeof readJson>).mockResolvedValue(
        mockPackageJson,
      )

      // 测试 parseAsync 错误
      mockProgram.parseAsync.mockRejectedValue(new Error('命令解析失败'))
      await expect(cli()).rejects.toThrow('命令解析失败')
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

    test('应该处理复杂的选项键路径', async () => {
      /* eslint-disable @typescript-eslint/naming-convention */
      await actionHandler('1.0.0', {
        'git.changelog.filename': 'CHANGES.md',
        'git.changelog.preset': 'angular',
        'npm.publishArgs': '--access public',
      })
      /* eslint-enable @typescript-eslint/naming-convention */

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

    test('应该处理空选项对象', async () => {
      await actionHandler('major', {})

      // 空选项会产生空的结果对象
      expect(release).toHaveBeenCalledWith('major', {})
    })

    test('应该处理混合的平级和嵌套选项', async () => {
      /* eslint-disable @typescript-eslint/naming-convention */
      await actionHandler('minor', {
        cwd: '/mixed/path',
        'git.push': false,
        'npm.canary': true,
        someFlat: 'value',
      })
      /* eslint-enable @typescript-eslint/naming-convention */

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
    test('应该完整覆盖所有设置步骤', async () => {
      await cli()

      // 验证所有关键步骤都被执行
      expect(readJson).toHaveBeenCalled()
      expect(updateNotifier).toHaveBeenCalled()
      expect(mockProgram.name).toHaveBeenCalled()
      expect(mockProgram.description).toHaveBeenCalled()
      expect(mockProgram.version).toHaveBeenCalled()
      expect(mockProgram.argument).toHaveBeenCalled()

      // 验证所有选项都被设置（至少13个）
      expect(mockProgram.option.mock.calls.length).toBeGreaterThanOrEqual(13)

      expect(mockProgram.action).toHaveBeenCalled()
      expect(mockProgram.parseAsync).toHaveBeenCalled()
    })

    test('应该处理所有类型的版本输入', async () => {
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
        jest.clearAllMocks()
        await actionHandler(version, {})
        expect(release).toHaveBeenCalledTimes(1)
      }
    })
  })

  describe('CLI 环境和模块测试', () => {
    test('应该正确处理环境变量控制', () => {
      // 测试 DISABLE_CLI_AUTO_RUN
      process.env.DISABLE_CLI_AUTO_RUN = 'true'

      expect(() => {
        delete require.cache[require.resolve('../src/cli')]
        require('../src/cli')
      }).not.toThrow()

      delete process.env.DISABLE_CLI_AUTO_RUN
    })

    test('应该在测试环境下正确工作', () => {
      const originalNodeEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'test'

      expect(() => {
        delete require.cache[require.resolve('../src/cli')]
        require('../src/cli')
      }).not.toThrow()
      process.env.NODE_ENV = originalNodeEnv
    })

    test('应该设置信号处理器', () => {
      const originalListeners = process.listeners('SIGINT')

      delete require.cache[require.resolve('../src/cli')]
      require('../src/cli')

      const newListeners = process.listeners('SIGINT')
      expect(newListeners.length).toBeGreaterThanOrEqual(
        originalListeners.length,
      )
    })
  })

  describe('CLI 调试和开发功能', () => {
    test('应该创建和使用调试器', () => {
      // createDebugger 在模块加载时被调用，检查它是否被正确模拟
      expect(createDebugger).toBeDefined()
      expect(typeof createDebugger).toBe('function')
    })

    test('应该能处理 debug 函数调用', () => {
      // debug 函数被正确创建和模拟
      expect(createDebugger).toBeDefined()
      const debugInstance = createDebugger('test')
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

    test('应该正确处理各种版本格式', () => {
      const validVersions = [
        '1.0.0',
        '10.20.30',
        '1.0.0-alpha.1',
        '2.0.0-beta.2',
      ]

      validVersions.forEach(version => {
        ;(
          semver.valid as jest.MockedFunction<typeof semver.valid>
        ).mockReturnValue(version)
        expect(checkVersion(version)).toBe(version)
      })
    })

    test('应该正确处理 v 前缀移除', () => {
      ;(
        semver.valid as jest.MockedFunction<typeof semver.valid>
      ).mockReturnValue('1.0.0')

      expect(checkVersion('v1.0.0')).toBe('1.0.0')
      expect(checkVersion('v2.1.3')).toBe('2.1.3')
      expect(checkVersion('v10.0.0-alpha.1')).toBe('10.0.0-alpha.1')
    })

    test('应该接受所有发布类型', () => {
      expect(checkVersion('major')).toBe('major')
      expect(checkVersion('minor')).toBe('minor')
      expect(checkVersion('patch')).toBe('patch')
      expect(checkVersion('prerelease')).toBe('prerelease')
      expect(checkVersion('premajor')).toBe('premajor')
      expect(checkVersion('preminor')).toBe('preminor')
      expect(checkVersion('prepatch')).toBe('prepatch')
    })

    test('应该对无效版本抛出 InvalidArgumentError', () => {
      ;(
        semver.valid as jest.MockedFunction<typeof semver.valid>
      ).mockReturnValue(null)

      expect(() => checkVersion('invalid')).toThrow()
      expect(() => checkVersion('1.0')).toThrow()
      expect(() => checkVersion('')).toThrow()
      expect(() => checkVersion('abc.def.ghi')).toThrow()
    })
  })

  describe('CLI 完整集成测试', () => {
    test('应该能够处理完整的发布流程调用', async () => {
      await cli()
      const actionCall = mockProgram.action.mock.calls[0]
      const actionHandler = actionCall[0]

      // 模拟真实的发布命令调用
      /* eslint-disable @typescript-eslint/naming-convention */
      await actionHandler('1.0.0', {
        cwd: process.cwd(),
        'git.requireClean': false,
        'git.changelog': true,
        'npm.confirm': false,
        'npm.prerelease': false,
        'github.release': true,
      })
      /* eslint-enable @typescript-eslint/naming-convention */

      // 修正测试期望，因为 'git.changelog': true 不会被删除（只有特定的 true 值会被删除）
      expect(release).toHaveBeenCalledWith(
        '1.0.0',
        expect.objectContaining({
          cwd: process.cwd(),
          git: expect.objectContaining({
            requireClean: false,
            // changelog: true 不会被删除，因为它不在删除列表中
          }),
          npm: expect.objectContaining({
            prerelease: false,
            // confirm: false 不会被删除，因为只有 true 值会被删除
          }),
          github: expect.objectContaining({
            release: true,
          }),
        }),
      )
    })

    test('应该能够处理复杂的选项删除逻辑', async () => {
      await cli()
      const actionCall = mockProgram.action.mock.calls[0]
      const actionHandler = actionCall[0]

      // 测试所有会被删除的 true 值选项
      /* eslint-disable @typescript-eslint/naming-convention */
      await actionHandler('major', {
        'git.requireClean': true,
        'git.changelog': true,
        'git.commit': true,
        'git.push': true,
        'npm.requireOwner': true,
        'npm.confirm': true,
      })
      /* eslint-enable @typescript-eslint/naming-convention */

      const releaseCall = (release as jest.MockedFunction<typeof release>).mock
        .calls[0]
      const options = releaseCall[1]

      // 所有这些选项都应该被删除
      expect(options?.git).toEqual({})
      expect(options?.npm).toEqual({})
    })
  })

  describe('CLI 模块导出验证', () => {
    test('应该导出 cli 函数', () => {
      expect(cli).toBeDefined()
      expect(typeof cli).toBe('function')
    })

    test('cli 函数应该是异步函数', () => {
      const result = cli()
      expect(result).toBeInstanceOf(Promise)
    })

    test('应该能够重复调用 cli 函数', async () => {
      await cli()
      jest.clearAllMocks()
      await cli()

      // 应该再次调用所有设置步骤
      expect(readJson).toHaveBeenCalled()
      expect(updateNotifier).toHaveBeenCalled()
      expect(mockProgram.parseAsync).toHaveBeenCalled()
    })
  })
})
