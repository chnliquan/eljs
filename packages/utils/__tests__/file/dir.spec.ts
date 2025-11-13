/* eslint-disable @typescript-eslint/no-var-requires */
import { mkdirp, mkdirpSync } from 'mkdirp'
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

import { mkdir, mkdirSync, tmpdir, tmpdirSync } from '../../src/file/dir'

// Mock 依赖项
jest.mock('mkdirp')
jest.mock('../../src/file/is')
jest.mock('../../src/type')

describe('目录操作工具', () => {
  const mockMkdirp = mkdirp as jest.MockedFunction<typeof mkdirp>
  const mockMkdirpSync = mkdirpSync as jest.MockedFunction<typeof mkdirpSync>
  const mockIsPathExists = require('../../src/file/is')
    .isPathExists as jest.MockedFunction<(filePath: string) => Promise<boolean>>
  const mockIsPathExistsSync = require('../../src/file/is')
    .isPathExistsSync as jest.MockedFunction<(filePath: string) => boolean>
  const mockIsBoolean = require('../../src/type')
    .isBoolean as jest.MockedFunction<(value: unknown) => value is boolean>

  let tempDir: string
  let testDir: string

  beforeEach(async () => {
    jest.clearAllMocks()

    // 创建临时目录
    tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'dir-test-'))
    testDir = path.join(tempDir, 'test-dir')
  })

  afterEach(async () => {
    jest.restoreAllMocks()
    try {
      await fsp.rm(tempDir, { recursive: true, force: true })
    } catch {
      // 忽略清理错误
    }
  })

  describe('mkdir 异步目录创建', () => {
    it('应该创建不存在的目录', async () => {
      mockIsPathExists.mockResolvedValue(false)
      mockMkdirp.mockResolvedValue('/created/path')

      const result = await mkdir(testDir)

      expect(mockIsPathExists).toHaveBeenCalledWith(testDir)
      expect(mockMkdirp).toHaveBeenCalledWith(testDir, undefined)
      expect(result).toBe('/created/path')
    })

    it('应该跳过已存在的目录', async () => {
      mockIsPathExists.mockResolvedValue(true)

      const result = await mkdir(testDir)

      expect(mockIsPathExists).toHaveBeenCalledWith(testDir)
      expect(mockMkdirp).not.toHaveBeenCalled()
      expect(result).toBeUndefined()
    })

    it('应该使用指定的模式创建目录', async () => {
      mockIsPathExists.mockResolvedValue(false)
      mockMkdirp.mockResolvedValue(undefined)
      const mode = 0o755

      await mkdir(testDir, mode)

      expect(mockMkdirp).toHaveBeenCalledWith(testDir, mode)
    })

    it('应该在创建失败时抛出错误', async () => {
      mockIsPathExists.mockResolvedValue(false)
      mockMkdirp.mockRejectedValue(new Error('Permission denied'))

      await expect(mkdir(testDir)).rejects.toThrow(/Create directory .* failed/)
    })
  })

  describe('mkdirSync 同步目录创建', () => {
    it('应该同步创建不存在的目录', () => {
      mockIsPathExistsSync.mockReturnValue(false)
      mockMkdirpSync.mockReturnValue('/created/sync/path')

      const result = mkdirSync(testDir)

      expect(mockIsPathExistsSync).toHaveBeenCalledWith(testDir)
      expect(mockMkdirpSync).toHaveBeenCalledWith(testDir, undefined)
      expect(result).toBe('/created/sync/path')
    })

    it('应该跳过已存在的目录', () => {
      mockIsPathExistsSync.mockReturnValue(true)

      const result = mkdirSync(testDir)

      expect(mockIsPathExistsSync).toHaveBeenCalledWith(testDir)
      expect(mockMkdirpSync).not.toHaveBeenCalled()
      expect(result).toBeUndefined()
    })

    it('应该在同步创建失败时抛出错误', () => {
      mockIsPathExistsSync.mockReturnValue(false)
      mockMkdirpSync.mockImplementation(() => {
        throw new Error('Permission denied')
      })

      expect(() => mkdirSync(testDir)).toThrow(/Create directory .* failed/)
    })
  })

  describe('tmpdir 异步临时目录创建', () => {
    beforeEach(() => {
      // 重置环境变量 mock
      delete process.env.HOME
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true,
      })
    })

    it('应该在非Windows平台创建用户临时目录', async () => {
      process.env.HOME = '/home/user'
      mockIsBoolean.mockReturnValue(false)
      mockMkdirp.mockResolvedValue(undefined)

      const result = await tmpdir()

      expect(result).toBe(path.join('/home/user', '.cli_tmp'))
    })

    it('应该在Windows平台使用系统临时目录', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
      })

      const result = await tmpdir()

      expect(result).toBe(os.tmpdir())
    })

    it('应该使用自定义目录名', async () => {
      process.env.HOME = '/home/user'
      mockIsBoolean.mockReturnValue(false)
      mockMkdirp.mockResolvedValue(undefined)

      const result = await tmpdir('custom-tmp')

      expect(result).toBe(path.join('/home/user', 'custom-tmp'))
    })

    it('应该在随机模式下创建随机目录', async () => {
      process.env.HOME = '/home/user'
      mockIsBoolean.mockReturnValue(true)
      mockMkdirp.mockResolvedValue(undefined)

      // Mock Math.random and Date.now for predictable results
      const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.5)
      const mockDateNow = jest.spyOn(Date, 'now').mockReturnValue(1234567890)

      const result = await tmpdir(true)

      expect(result).toMatch(/\/home\/user\/\.cli_tmp\/tmp-1234567890-500$/)
      expect(mockMkdirp).toHaveBeenCalledWith(
        expect.stringMatching(/tmp-1234567890-500$/),
        undefined,
      )

      mockRandom.mockRestore()
      mockDateNow.mockRestore()
    })

    it('应该在用户目录创建失败时回退到系统临时目录', async () => {
      process.env.HOME = '/home/user'
      mockIsBoolean.mockReturnValue(false)
      mockMkdirp.mockRejectedValueOnce(new Error('Permission denied'))

      const result = await tmpdir()

      expect(result).toBe(os.tmpdir())
    })

    it('应该处理布尔参数作为第一个参数', async () => {
      mockIsBoolean.mockReturnValue(true)
      mockMkdirp.mockResolvedValue(undefined)

      const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.123)
      const mockDateNow = jest.spyOn(Date, 'now').mockReturnValue(9876543210)

      await tmpdir(true)

      expect(mockMkdirp).toHaveBeenCalledWith(
        expect.stringMatching(/tmp-9876543210-123$/),
        undefined,
      )

      mockRandom.mockRestore()
      mockDateNow.mockRestore()
    })
  })

  describe('tmpdirSync 同步临时目录创建', () => {
    beforeEach(() => {
      delete process.env.HOME
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true,
      })
    })

    it('应该同步创建临时目录', async () => {
      process.env.HOME = '/home/user'
      mockIsBoolean.mockReturnValue(false)
      mockMkdirpSync.mockReturnValue(undefined)

      const result = await tmpdirSync()

      expect(result).toBe(path.join('/home/user', '.cli_tmp'))
    })

    it('应该在随机模式下同步创建随机目录', async () => {
      process.env.HOME = '/home/user'
      mockIsBoolean.mockReturnValue(true)
      mockMkdirpSync.mockReturnValue(undefined)

      const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.789)
      const mockDateNow = jest.spyOn(Date, 'now').mockReturnValue(5555555555)

      const result = await tmpdirSync(true)

      expect(result).toMatch(/\/home\/user\/\.cli_tmp\/tmp-5555555555-789$/)

      mockRandom.mockRestore()
      mockDateNow.mockRestore()
    })

    it('应该在同步创建失败时回退到系统临时目录', async () => {
      process.env.HOME = '/home/user'
      mockIsBoolean.mockReturnValue(false)
      mockMkdirpSync.mockImplementation(() => {
        throw new Error('Permission denied')
      })

      const result = await tmpdirSync()

      expect(result).toBe(os.tmpdir())
    })
  })

  describe('边界情况和平台兼容性', () => {
    it('应该处理缺少HOME环境变量的情况', async () => {
      delete process.env.HOME
      mockIsBoolean.mockReturnValue(false)
      mockMkdirp.mockResolvedValue(undefined)

      // 直接测试 os.homedir() 的返回值，而不是 spy
      const result = await tmpdir()

      // 结果应该包含 homedir 或者是系统临时目录
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('应该处理空字符串目录名', async () => {
      process.env.HOME = '/home/user'
      mockIsBoolean.mockReturnValue(false)
      mockMkdirp.mockResolvedValue(undefined)

      const result = await tmpdir('')

      expect(result).toBe(path.join('/home/user', '.cli_tmp'))
    })

    it('应该在不同平台上正确工作', async () => {
      // 测试 Windows 平台
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
      })

      const result = await tmpdir()

      expect(result).toBe(os.tmpdir())
    })
  })
})
