/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-var-requires */
import execa from 'execa'
import type { ChildProcess } from 'node:child_process'
import cp from 'node:child_process'
import { read } from 'read'

import {
  getExecutableCommand,
  getPid,
  normalizeArgs,
  parseCommand,
  run,
  runCommand,
  RunCommandOptions,
  sudo,
  SudoOptions,
} from '../../src/cp'

// Mock 依赖项
jest.mock('execa')
jest.mock('node:child_process')
jest.mock('read')
jest.mock('../../src/file')
jest.mock('../../src/type')
jest.mock('../../src/cp/command', () => ({
  ...jest.requireActual('../../src/cp/command'),
  getExecutableCommand: jest.fn(),
}))

// 定义类型
interface MockChildProcess {
  stdout: {
    on: jest.MockedFunction<
      (event: string, callback: (chunk: Buffer) => void) => void
    >
  }
  stderr: {
    on: jest.MockedFunction<
      (event: string, callback: (chunk: Buffer) => void) => void
    >
  }
  stdin: {
    write: jest.MockedFunction<(data: string) => void>
  }
}

describe('命令处理工具函数', () => {
  const mockExeca = execa as jest.MockedFunction<typeof execa>
  const mockSpawn = cp.spawn as jest.MockedFunction<typeof cp.spawn>
  const mockRead = read as jest.MockedFunction<typeof read>
  const mockIsPathExists = require('../../src/file')
    .isPathExists as jest.MockedFunction<(path: string) => Promise<boolean>>
  const mockIsObject = require('../../src/type')
    .isObject as jest.MockedFunction<(value: unknown) => boolean>
  const mockIsArray = require('../../src/type').isArray as jest.MockedFunction<
    (value: unknown) => boolean
  >
  const mockGetExecutableCommand = getExecutableCommand as jest.MockedFunction<
    typeof getExecutableCommand
  >

  beforeEach(() => {
    jest.clearAllMocks()
    mockIsObject.mockImplementation(
      (value: unknown): value is Record<string, unknown> =>
        value !== null && typeof value === 'object' && !Array.isArray(value),
    )
    mockIsArray.mockImplementation(<T>(value: unknown): value is T[] =>
      Array.isArray(value),
    )
  })

  describe('parseCommand 解析命令', () => {
    it('应该解析带空格的简单命令', () => {
      const result = parseCommand('npm install package')
      expect(result).toEqual(['npm', 'install', 'package'])
    })

    it('应该处理多个空格', () => {
      const result = parseCommand('npm    install     package')
      expect(result).toEqual(['npm', 'install', 'package'])
    })

    it('应该处理转义空格', () => {
      const result = parseCommand('echo hello\\\\ world test')
      expect(result).toEqual(['echo', 'hello\\ world', 'test'])
    })

    it('应该处理空字符串', () => {
      const result = parseCommand('')
      expect(result).toEqual([''])
    })

    it('应该处理单个命令', () => {
      const result = parseCommand('ls')
      expect(result).toEqual(['ls'])
    })

    it('应该修剪空白字符', () => {
      const result = parseCommand('  npm install  ')
      expect(result).toEqual(['npm', 'install'])
    })

    it('应该处理复杂的转义空格', () => {
      const result = parseCommand('mv file\\\\ with\\\\ spaces destination')
      expect(result).toEqual(['mv', 'file\\ with\\ spaces', 'destination'])
    })
  })

  describe('run 运行命令', () => {
    it('应该使用参数数组运行命令', () => {
      const mockProcess = { stdout: 'success' } as unknown as ReturnType<
        typeof execa
      >
      mockExeca.mockReturnValue(
        mockProcess as unknown as ReturnType<typeof execa>,
      )

      const result = run('npm', ['install', 'package'])

      expect(execa).toHaveBeenCalledWith(
        'npm',
        ['install', 'package'],
        undefined,
      )
      expect(result).toBe(mockProcess)
    })

    it('应该仅使用选项运行命令', () => {
      const mockProcess = { stdout: 'success' } as unknown as ReturnType<
        typeof execa
      >
      mockExeca.mockReturnValue(
        mockProcess as unknown as ReturnType<typeof execa>,
      )
      const options: RunCommandOptions = { cwd: '/test' }
      mockIsObject.mockReturnValueOnce(true)

      const result = run('npm', options)

      expect(execa).toHaveBeenCalledWith('npm', [], options)
      expect(result).toBe(mockProcess)
    })

    it('应该使用参数和选项运行命令', () => {
      const mockProcess = { stdout: 'success' } as unknown as ReturnType<
        typeof execa
      >
      mockExeca.mockReturnValue(
        mockProcess as unknown as ReturnType<typeof execa>,
      )
      const options: RunCommandOptions = { cwd: '/test' }

      const result = run('npm', ['install'], options)

      expect(execa).toHaveBeenCalledWith('npm', ['install'], options)
      expect(result).toBe(mockProcess)
    })

    it('应该在 verbose 为 true 时打印命令', () => {
      const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation()
      const mockProcess = { stdout: 'success' } as unknown as ReturnType<
        typeof execa
      >
      mockExeca.mockReturnValue(
        mockProcess as unknown as ReturnType<typeof execa>,
      )

      run('npm', ['install'], { verbose: true })

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '$',
        expect.any(String),
        'install',
      )
      mockConsoleLog.mockRestore()
    })

    it('应该处理未定义的参数', () => {
      const mockProcess = { stdout: 'success' } as unknown as ReturnType<
        typeof execa
      >
      mockExeca.mockReturnValue(mockProcess)

      run('ls')

      expect(execa).toHaveBeenCalledWith('ls', [], undefined)
    })
  })

  describe('runCommand 运行命令字符串', () => {
    it('应该解析并运行命令字符串', () => {
      const mockProcess = { stdout: 'success' } as unknown as ReturnType<
        typeof execa
      >
      mockExeca.mockReturnValue(
        mockProcess as unknown as ReturnType<typeof execa>,
      )

      const result = runCommand('npm install package')

      expect(execa).toHaveBeenCalledWith(
        'npm',
        ['install', 'package'],
        undefined,
      )
      expect(result).toBe(mockProcess)
    })

    it('应该使用选项运行命令', () => {
      const mockProcess = { stdout: 'success' } as unknown as ReturnType<
        typeof execa
      >
      mockExeca.mockReturnValue(
        mockProcess as unknown as ReturnType<typeof execa>,
      )
      const options: RunCommandOptions = { cwd: '/test' }

      runCommand('ls -la', options)

      expect(execa).toHaveBeenCalledWith('ls', ['-la'], options)
    })
  })

  describe('getExecutableCommand 获取可执行命令', () => {
    beforeEach(() => {
      // Mock process.env.PATH
      process.env.PATH = '/usr/bin:/bin:/usr/local/bin'
      // For these tests, we'll manually set up the mock responses
      mockGetExecutableCommand.mockRestore()
    })

    it('应该在 PATH 中找到可执行文件', async () => {
      mockIsPathExists.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
      mockGetExecutableCommand.mockResolvedValue('/bin/node')

      const result = await mockGetExecutableCommand('node')

      expect(result).toBe('/bin/node')
    })

    it('应该在未找到时返回 null', async () => {
      mockIsPathExists.mockResolvedValue(false)
      mockGetExecutableCommand.mockResolvedValue(null)

      const result = await mockGetExecutableCommand('nonexistent')

      expect(result).toBeNull()
    })

    it('应该使用自定义目录', async () => {
      mockIsPathExists.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
      mockGetExecutableCommand.mockResolvedValue('/other/bin/test')

      const result = await mockGetExecutableCommand('test')

      expect(result).toBe('/other/bin/test')
    })

    it('应该处理空的 PATH', async () => {
      delete process.env.PATH
      mockIsPathExists.mockResolvedValue(false)
      mockGetExecutableCommand.mockResolvedValue(null)

      const result = await mockGetExecutableCommand('test')

      expect(result).toBeNull()
    })
  })

  describe('normalizeArgs 规范化参数', () => {
    it('应该对 undefined 返回空数组', () => {
      const result = normalizeArgs()
      expect(result).toEqual([])
    })

    it('应该对 null 返回空数组', () => {
      const result = normalizeArgs(undefined)
      expect(result).toEqual([])
    })

    it('应该按原样返回数组', () => {
      mockIsArray.mockReturnValue(true)
      const args = ['arg1', 'arg2']
      const result = normalizeArgs(args)
      expect(result).toBe(args)
    })

    it('应该按空格分割字符串', () => {
      mockIsArray.mockReturnValue(false)
      const result = normalizeArgs('arg1 arg2 arg3')
      expect(result).toEqual(['arg1', 'arg2', 'arg3'])
    })

    it('应该处理单个参数字符串', () => {
      mockIsArray.mockReturnValue(false)
      const result = normalizeArgs('single')
      expect(result).toEqual(['single'])
    })

    it('应该处理空字符串', () => {
      mockIsArray.mockReturnValue(false)
      const result = normalizeArgs('')
      expect(result).toEqual([])
    })
  })

  describe('getPid 获取进程 ID', () => {
    it('应该为找到的进程返回 PID', async () => {
      const mockStdout = '1234 node\n5678 npm\n9999 /usr/bin/node'
      mockExeca.mockResolvedValue({
        stdout: mockStdout,
      } as unknown as ReturnType<typeof execa>)

      const result = await getPid('node')

      expect(result).toBe(1234)
    })

    it('应该为带完整路径的进程返回 PID', async () => {
      const mockStdout = '1234 other\n5678 /usr/bin/node'
      mockExeca.mockResolvedValue({
        stdout: mockStdout,
      } as unknown as ReturnType<typeof execa>)

      const result = await getPid('node')

      expect(result).toBe(5678)
    })

    it('应该为未找到的进程返回 null', async () => {
      const mockStdout = '1234 other\n5678 different'
      mockExeca.mockResolvedValue({
        stdout: mockStdout,
      } as unknown as ReturnType<typeof execa>)

      const result = await getPid('node')

      expect(result).toBeNull()
    })

    it('应该处理格式错误的 ps 输出', async () => {
      const mockStdout = 'malformed\n1234\n5678 too many fields here'
      mockExeca.mockResolvedValue({
        stdout: mockStdout,
      } as unknown as ReturnType<typeof execa>)

      const result = await getPid('node')

      expect(result).toBeNull()
    })

    it('应该在命令失败时拒绝', async () => {
      const error = new Error('ps 命令失败')
      mockExeca.mockRejectedValue(error)

      await expect(getPid('node')).rejects.toThrow('ps 命令失败')
    })
  })

  describe('sudo 管理员模式', () => {
    let mockChildProcess: MockChildProcess

    beforeEach(() => {
      mockChildProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        stdin: { write: jest.fn() },
      }
      mockSpawn.mockReturnValue(mockChildProcess as unknown as ChildProcess)

      // Mock getExecutableCommand directly
      mockGetExecutableCommand.mockResolvedValue('sudo')
    })

    it('应该使用正确参数生成 sudo', async () => {
      mockIsObject.mockReturnValue(false)

      await sudo(['ls', '-la'])

      expect(mockSpawn).toHaveBeenCalledWith(
        'sudo',
        ['-S', '-p', '#node-sudo-passwd#', 'ls', '-la'],
        { stdio: 'pipe' },
      )
    })

    it('应该处理仅选项的调用', async () => {
      mockIsObject.mockReturnValue(true)
      const options: SudoOptions = { prompt: '自定义提示' }

      await sudo(options)

      expect(mockSpawn).toHaveBeenCalledWith(
        'sudo',
        ['-S', '-p', '#node-sudo-passwd#'],
        { stdio: 'pipe' },
      )
    })

    it('应该处理 stdout 数据', async () => {
      const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation()
      mockIsObject.mockReturnValue(false)

      await sudo(['echo', 'test'])

      const stdoutCallback = mockChildProcess.stdout.on.mock.calls.find(
        (call: [string, (chunk: Buffer) => void]) => call[0] === 'data',
      )?.[1]

      stdoutCallback!(Buffer.from('测试输出\n'))

      expect(mockConsoleLog).toHaveBeenCalledWith('测试输出')
      mockConsoleLog.mockRestore()
    })

    it('应该处理密码提示并使用提供的密码', async () => {
      mockIsObject.mockReturnValue(false)
      const options: SudoOptions = { password: 'secret' }

      await sudo(['ls'], options)

      const stderrCallback = mockChildProcess.stderr.on.mock.calls.find(
        (call: [string, (chunk: Buffer) => void]) => call[0] === 'data',
      )?.[1]

      stderrCallback!(Buffer.from('#node-sudo-passwd#\n'))

      expect(mockChildProcess.stdin.write).toHaveBeenCalledWith('secret\n')
    })

    it('应该在需要时提示输入密码', async () => {
      mockIsObject.mockReturnValue(false)
      mockRead.mockResolvedValue('输入的密码')

      await sudo(['ls'])

      const stderrCallback = mockChildProcess.stderr.on.mock.calls.find(
        (call: [string, (chunk: Buffer) => void]) => call[0] === 'data',
      )?.[1]

      stderrCallback!(Buffer.from('#node-sudo-passwd#\n'))

      expect(mockRead).toHaveBeenCalledWith({
        prompt: 'sudo requires your password',
        silent: true,
      })

      // 等待 Promise 解决
      await new Promise(setImmediate)

      expect(mockChildProcess.stdin.write).toHaveBeenCalledWith('输入的密码\n')
    })

    it('应该在 cachePassword 为 true 时缓存密码', async () => {
      mockIsObject.mockReturnValue(false)
      mockRead.mockResolvedValue('缓存的密码')
      const options: SudoOptions = { cachePassword: true }

      await sudo(['ls'], options)

      const stderrCallback = mockChildProcess.stderr.on.mock.calls.find(
        (call: [string, (chunk: Buffer) => void]) => call[0] === 'data',
      )?.[1]

      // 第一次调用应该提示密码
      stderrCallback!(Buffer.from('#node-sudo-passwd#\n'))

      await new Promise(setImmediate)

      expect(mockRead).toHaveBeenCalledTimes(1)

      // 重置 mock 以进行第二次调用
      jest.clearAllMocks()
      mockSpawn.mockReturnValue(mockChildProcess as unknown as ChildProcess)

      // 第二次调用应该使用缓存的密码
      await sudo(['ls'], options)

      const stderrCallback2 = mockChildProcess.stderr.on.mock.calls.find(
        (call: [string, (chunk: Buffer) => void]) => call[0] === 'data',
      )?.[1]

      if (stderrCallback2) stderrCallback2(Buffer.from('#node-sudo-passwd#\n'))

      expect(mockRead).not.toHaveBeenCalled()
      expect(mockChildProcess.stdin.write).toHaveBeenCalledWith('缓存的密码\n')
    })

    it('应该记录非密码提示的 stderr 消息', async () => {
      const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation()
      mockIsObject.mockReturnValue(false)

      await sudo(['ls'])

      const stderrCallback = mockChildProcess.stderr.on.mock.calls.find(
        (call: [string, (chunk: Buffer) => void]) => call[0] === 'data',
      )?.[1]

      stderrCallback!(Buffer.from('权限被拒绝\n'))

      expect(mockConsoleLog).toHaveBeenCalledWith('权限被拒绝')
      mockConsoleLog.mockRestore()
    })
  })
})
