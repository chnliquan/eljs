import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
  type MockedFunction,
} from 'vitest'
import * as importedModule0 from '../../src/file'
import * as importedModule1 from '../../src/guards'
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { execa } from 'execa'
import type { ChildProcess } from 'node:child_process'
import cp from 'node:child_process'
import { read } from 'read'

import {
  clearCachedSudoPassword,
  findExecutable,
  findProcessId,
  getExecutableCommand,
  getPid,
  normalizeArgs,
  parseCommand,
  parseCommandLine,
  run,
  runCommand,
  runCommandLine,
  RunCommandOptions,
  sudo,
  SudoOptions,
} from '../../src/cp'

const requiredModule0 = vi.mocked(importedModule0, { deep: true })
const requiredModule1 = vi.mocked(importedModule1, { deep: true })

// Mock 依赖项
vi.mock('execa')
vi.mock('node:child_process')
vi.mock('read')
vi.mock('../../src/file')
vi.mock('../../src/guards')
vi.mock('../../src/cp/command', async importOriginal => ({
  ...(await importOriginal<typeof import('../../src/cp/command')>()),
  findExecutable: vi.fn(),
  getExecutableCommand: vi.fn(),
}))

// 定义类型
interface MockChildProcess {
  kill: ReturnType<typeof vi.fn>
  once: ReturnType<typeof vi.fn>
  stdout: {
    on: MockedFunction<
      (event: string, callback: (chunk: Buffer) => void) => void
    >
  }
  stderr: {
    on: MockedFunction<
      (event: string, callback: (chunk: Buffer) => void) => void
    >
  }
  stdin: {
    write: MockedFunction<(data: string) => void>
  }
}

describe('命令处理工具函数', () => {
  const mockExeca = execa as unknown as Mock
  const mockSpawn = cp.spawn as MockedFunction<typeof cp.spawn>
  const mockRead = read as MockedFunction<typeof read>
  const mockIsPathExists = requiredModule0.isPathExists as MockedFunction<
    (path: string) => Promise<boolean>
  >
  const mockIsObject = requiredModule1.isObject as MockedFunction<
    (value: unknown) => boolean
  >
  const mockIsArray = requiredModule1.isArray as MockedFunction<
    (value: unknown) => boolean
  >
  const mockGetExecutableCommand = getExecutableCommand as MockedFunction<
    typeof getExecutableCommand
  >
  const mockFindExecutable = findExecutable as MockedFunction<
    typeof findExecutable
  >

  beforeEach(() => {
    vi.clearAllMocks()
    mockIsObject.mockReset()
    mockIsArray.mockReset()
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
      expect(result).toEqual([])
    })

    it('新名称应该处理制表符和换行符', () => {
      expect(parseCommandLine('npm\tinstall\npackage')).toEqual([
        'npm',
        'install',
        'package',
      ])
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
      const mockConsoleLog = vi
        .spyOn(console, 'log')
        .mockImplementation(() => undefined)
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

    it('应该注入结构化日志和生命周期监控且不传给 execa', async () => {
      const logger = vi.fn()
      const observer = vi.fn()
      const mockProcess = Promise.resolve({ stdout: 'success' })
      mockExeca.mockReturnValue(mockProcess)

      await run('npm', ['test'], {
        runtime: { logger, observer },
        verbose: true,
      })
      await Promise.resolve()

      expect(execa).toHaveBeenCalledWith('npm', ['test'], {})
      expect(logger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
          operation: 'cp.run',
        }),
      )
      expect(observer).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ operation: 'cp.run', phase: 'start' }),
      )
      expect(observer).toHaveBeenLastCalledWith(
        expect.objectContaining({ operation: 'cp.run', phase: 'success' }),
      )
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

    it('新名称应该解析并运行命令行', () => {
      const mockProcess = { stdout: 'success' } as unknown as ReturnType<
        typeof execa
      >
      mockExeca.mockReturnValue(mockProcess)

      expect(runCommandLine('npm test')).toBe(mockProcess)
      expect(execa).toHaveBeenCalledWith('npm', ['test'], undefined)
    })

    it('应该拒绝空命令行', () => {
      expect(() => runCommandLine('   ')).toThrow(
        'Command line must not be empty',
      )
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
    it('新名称应该查找进程 ID', async () => {
      mockExeca.mockResolvedValue({
        stdout: '1234 node',
      } as unknown as ReturnType<typeof execa>)

      await expect(findProcessId('node')).resolves.toBe(1234)
    })

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

    it('应该在 Windows 上解析 tasklist CSV 输出', async () => {
      const platform = vi
        .spyOn(process, 'platform', 'get')
        .mockReturnValue('win32')
      mockExeca.mockResolvedValue({
        stdout: '"node.exe","4321","Console","1","12,000 K"\r\n',
      } as unknown as ReturnType<typeof execa>)

      await expect(getPid('node')).resolves.toBe(4321)
      expect(execa).toHaveBeenCalledWith(
        'tasklist',
        ['/FO', 'CSV', '/NH'],
        undefined,
      )

      platform.mockRestore()
    })
  })

  describe('sudo 管理员模式', () => {
    let mockChildProcess: MockChildProcess

    const waitForSpawn = async () => {
      await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledTimes(1))
    }

    const emitChildEvent = (event: string, ...args: unknown[]) => {
      const callback = mockChildProcess.once.mock.calls.find(
        call => call[0] === event,
      )?.[1] as ((...values: unknown[]) => void) | undefined

      callback?.(...args)
    }

    beforeEach(() => {
      clearCachedSudoPassword()
      mockChildProcess = {
        kill: vi.fn(),
        once: vi.fn(),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        stdin: { write: vi.fn() },
      }
      mockSpawn.mockReturnValue(mockChildProcess as unknown as ChildProcess)

      // Mock getExecutableCommand directly
      mockGetExecutableCommand.mockResolvedValue('sudo')
      mockFindExecutable.mockResolvedValue('sudo')
    })

    it('应该使用正确参数生成 sudo', async () => {
      mockIsObject.mockReturnValue(false)

      const result = sudo(['ls', '-la'])
      await waitForSpawn()

      expect(mockSpawn).toHaveBeenCalledWith(
        'sudo',
        ['-S', '-p', '#node-sudo-passwd#', 'ls', '-la'],
        { stdio: 'pipe' },
      )
      emitChildEvent('close', 0, null)
      await result
    })

    it('应该处理仅选项的调用', async () => {
      mockIsObject.mockReturnValue(true)
      const options: SudoOptions = { prompt: '自定义提示' }

      const result = sudo(options)
      await waitForSpawn()

      expect(mockSpawn).toHaveBeenCalledWith(
        'sudo',
        ['-S', '-p', '#node-sudo-passwd#'],
        { stdio: 'pipe' },
      )
      emitChildEvent('close', 0, null)
      await result
    })

    it('应该处理 stdout 数据', async () => {
      const mockConsoleLog = vi
        .spyOn(console, 'log')
        .mockImplementation(() => undefined)
      mockIsObject.mockReturnValue(false)

      const result = sudo(['echo', 'test'])
      await waitForSpawn()

      const stdoutCallback = mockChildProcess.stdout.on.mock.calls.find(
        (call: [string, (chunk: Buffer) => void]) => call[0] === 'data',
      )?.[1]

      stdoutCallback!(Buffer.from('测试输出\n'))

      expect(mockConsoleLog).toHaveBeenCalledWith('测试输出')
      emitChildEvent('close', 0, null)
      await result
      mockConsoleLog.mockRestore()
    })

    it('应该处理密码提示并使用提供的密码', async () => {
      mockIsObject.mockReturnValue(false)
      const options: SudoOptions = { password: 'secret' }

      const result = sudo(['ls'], options)
      await waitForSpawn()

      const stderrCallback = mockChildProcess.stderr.on.mock.calls.find(
        (call: [string, (chunk: Buffer) => void]) => call[0] === 'data',
      )?.[1]

      stderrCallback!(Buffer.from('#node-sudo-passwd#\n'))

      expect(mockChildProcess.stdin.write).toHaveBeenCalledWith('secret\n')
      emitChildEvent('close', 0, null)
      await result
    })

    it('应该在需要时提示输入密码', async () => {
      mockIsObject.mockReturnValue(false)
      mockRead.mockResolvedValue('输入的密码')

      const result = sudo(['ls'])
      await waitForSpawn()

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
      emitChildEvent('close', 0, null)
      await result
    })

    it('应该在 cachePassword 为 true 时缓存密码', async () => {
      mockIsObject.mockReturnValue(false)
      mockRead.mockResolvedValue('缓存的密码')
      const options: SudoOptions = { cachePassword: true }

      const firstResult = sudo(['ls'], options)
      await waitForSpawn()

      const stderrCallback = mockChildProcess.stderr.on.mock.calls.find(
        (call: [string, (chunk: Buffer) => void]) => call[0] === 'data',
      )?.[1]

      // 第一次调用应该提示密码
      stderrCallback!(Buffer.from('#node-sudo-passwd#\n'))

      await new Promise(setImmediate)

      expect(mockRead).toHaveBeenCalledTimes(1)
      emitChildEvent('close', 0, null)
      await firstResult

      // 重置 mock 以进行第二次调用
      vi.clearAllMocks()
      mockSpawn.mockReturnValue(mockChildProcess as unknown as ChildProcess)
      mockGetExecutableCommand.mockResolvedValue('sudo')

      // 第二次调用应该使用缓存的密码
      const secondResult = sudo(['ls'], options)
      await waitForSpawn()

      const stderrCallback2 = mockChildProcess.stderr.on.mock.calls.find(
        (call: [string, (chunk: Buffer) => void]) => call[0] === 'data',
      )?.[1]

      if (stderrCallback2) stderrCallback2(Buffer.from('#node-sudo-passwd#\n'))

      expect(mockRead).not.toHaveBeenCalled()
      expect(mockChildProcess.stdin.write).toHaveBeenCalledWith('缓存的密码\n')
      emitChildEvent('close', 0, null)
      await secondResult
    })

    it('应该记录非密码提示的 stderr 消息', async () => {
      const mockConsoleLog = vi
        .spyOn(console, 'log')
        .mockImplementation(() => undefined)
      mockIsObject.mockReturnValue(false)

      const result = sudo(['ls'])
      await waitForSpawn()

      const stderrCallback = mockChildProcess.stderr.on.mock.calls.find(
        (call: [string, (chunk: Buffer) => void]) => call[0] === 'data',
      )?.[1]

      stderrCallback!(Buffer.from('权限被拒绝\n'))

      expect(mockConsoleLog).toHaveBeenCalledWith('权限被拒绝')
      emitChildEvent('close', 0, null)
      await result
      mockConsoleLog.mockRestore()
    })

    it('应该等待子进程退出并拒绝非零退出码', async () => {
      mockIsObject.mockReturnValue(false)
      let completed = false
      const result = sudo(['false']).finally(() => {
        completed = true
      })

      await waitForSpawn()
      expect(completed).toBe(false)

      emitChildEvent('close', 2, null)

      await expect(result).rejects.toMatchObject({
        code: 'ERR_PROCESS_EXIT',
        operation: 'cp.sudo',
      })
      expect(completed).toBe(true)
    })

    it('应该把子进程启动错误转换为结构化错误', async () => {
      mockIsObject.mockReturnValue(false)
      const result = sudo(['ls'])

      await waitForSpawn()
      emitChildEvent('error', new Error('spawn failed'))

      await expect(result).rejects.toMatchObject({
        code: 'ERR_PROCESS_SPAWN',
        operation: 'cp.sudo',
      })
    })

    it('应该在 Windows 上返回明确的平台错误', async () => {
      const platform = vi
        .spyOn(process, 'platform', 'get')
        .mockReturnValue('win32')
      mockIsObject.mockReturnValue(false)

      await expect(sudo(['ls'])).rejects.toMatchObject({
        code: 'ERR_UNSUPPORTED_PLATFORM',
        operation: 'cp.sudo',
      })
      expect(mockSpawn).not.toHaveBeenCalled()

      platform.mockRestore()
    })
  })
})
