/* eslint-disable @typescript-eslint/no-var-requires */
import type { ExecaReturnValue } from 'execa'
import execa from 'execa'

import * as envModule from '../../src/env'
import { hasGlobalInstallation } from '../../src/env'

// Mock 依赖项
jest.mock('execa')

describe('环境工具函数', () => {
  const mockExeca = execa as jest.MockedFunction<typeof execa>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('模块导出', () => {
    it('应该导出所有预期的功能', () => {
      expect(typeof envModule.hasGlobalInstallation).toBe('function')

      // 测试重导出模块的所有可能路径
      const allExports = Object.keys(envModule)
      expect(allExports).toContain('hasGlobalInstallation')
    })

    it('应该能够通过通配符导出访问所有功能', () => {
      expect(envModule).toBeDefined()
      expect(Object.getOwnPropertyNames(envModule).length).toBeGreaterThan(0)
    })
  })

  describe('hasGlobalInstallation', () => {
    it('应该在命令存在且返回版本号时返回 true', async () => {
      const mockResult = {
        stdout: '1.2.3',
        stderr: '',
        exitCode: 0,
        failed: false,
        killed: false,
        signal: undefined,
        command: 'test --version',
        escapedCommand: 'test --version',
        timedOut: false,
        isCanceled: false,
        shortMessage: '',
        message: '',
        all: '1.2.3',
      } as unknown as ExecaReturnValue

      mockExeca.mockResolvedValue(
        mockResult as unknown as ReturnType<typeof execa>,
      )

      const result = await hasGlobalInstallation('test')

      expect(result).toBe(true)
      expect(mockExeca).toHaveBeenCalledWith('test', ['--version'])
    })

    it('应该在版本号格式正确时返回 true', async () => {
      const mockResult: Partial<ExecaReturnValue> = {
        stdout: 'v10.15.3',
        stderr: '',
      }

      mockExeca.mockResolvedValue(
        mockResult as unknown as ReturnType<typeof execa>,
      )

      const result = await hasGlobalInstallation('node')

      expect(result).toBe(true)
      expect(mockExeca).toHaveBeenCalledWith('node', ['--version'])
    })

    it('应该在输出不包含版本号时返回 false', async () => {
      const mockResult: Partial<ExecaReturnValue> = {
        stdout: 'no version here',
        stderr: '',
      }

      mockExeca.mockResolvedValue(
        mockResult as unknown as ReturnType<typeof execa>,
      )

      const result = await hasGlobalInstallation('invalid')

      expect(result).toBe(false)
      expect(mockExeca).toHaveBeenCalledWith('invalid', ['--version'])
    })

    it('应该在命令失败时返回 false', async () => {
      mockExeca.mockRejectedValue(new Error('Command not found'))

      const result = await hasGlobalInstallation('nonexistent')

      expect(result).toBe(false)
      expect(mockExeca).toHaveBeenCalledWith('nonexistent', ['--version'])
    })

    it('应该缓存成功的结果', async () => {
      const mockResult: Partial<ExecaReturnValue> = {
        stdout: '2.0.0',
      }

      mockExeca.mockResolvedValue(
        mockResult as unknown as ReturnType<typeof execa>,
      )

      // 第一次调用
      const result1 = await hasGlobalInstallation('cached-tool')
      expect(result1).toBe(true)
      expect(mockExeca).toHaveBeenCalledTimes(1)

      // 第二次调用应该使用缓存
      const result2 = await hasGlobalInstallation('cached-tool')
      expect(result2).toBe(true)
      expect(mockExeca).toHaveBeenCalledTimes(1) // 没有新的调用
    })

    it('应该缓存版本号不匹配的结果', async () => {
      const mockResult: Partial<ExecaReturnValue> = {
        stdout: 'no version here',
      }

      mockExeca.mockResolvedValue(
        mockResult as unknown as ReturnType<typeof execa>,
      )

      // 第一次调用
      const result1 = await hasGlobalInstallation('no-version-tool')
      expect(result1).toBe(false)
      expect(mockExeca).toHaveBeenCalledTimes(1)

      // 第二次调用应该使用缓存
      const result2 = await hasGlobalInstallation('no-version-tool')
      expect(result2).toBe(false)
      expect(mockExeca).toHaveBeenCalledTimes(1) // 没有新的调用
    })

    it('应该不缓存失败的结果', async () => {
      mockExeca.mockRejectedValue(new Error('Command failed'))

      // 第一次调用
      const result1 = await hasGlobalInstallation('failed-tool')
      expect(result1).toBe(false)
      expect(mockExeca).toHaveBeenCalledTimes(1)

      // 第二次调用应该再次尝试，因为失败的结果不被缓存
      const result2 = await hasGlobalInstallation('failed-tool')
      expect(result2).toBe(false)
      expect(mockExeca).toHaveBeenCalledTimes(2) // 又调用了一次
    })

    it('应该为不同的命令使用不同的缓存', async () => {
      const mockResult1: Partial<ExecaReturnValue> = { stdout: '1.0.0' }
      const mockResult2: Partial<ExecaReturnValue> = { stdout: '2.0.0' }

      mockExeca
        .mockResolvedValueOnce(
          mockResult1 as unknown as ReturnType<typeof execa>,
        )
        .mockResolvedValueOnce(
          mockResult2 as unknown as ReturnType<typeof execa>,
        )

      const result1 = await hasGlobalInstallation('tool1')
      const result2 = await hasGlobalInstallation('tool2')

      expect(result1).toBe(true)
      expect(result2).toBe(true)
      expect(mockExeca).toHaveBeenCalledTimes(2)
      expect(mockExeca).toHaveBeenNthCalledWith(1, 'tool1', ['--version'])
      expect(mockExeca).toHaveBeenNthCalledWith(2, 'tool2', ['--version'])
    })

    it('应该正确解析复杂的版本号格式', async () => {
      const testCases: Array<{ output: string; expected: boolean }> = [
        { output: '1.2.3', expected: true },
        { output: 'v1.2.3', expected: true },
        { output: 'version 1.2.3', expected: true },
        { output: '10.15.3', expected: true },
        { output: '0.1.0', expected: true },
        { output: 'npm 6.14.8', expected: true },
        { output: 'no version', expected: false },
        { output: '1.2', expected: false },
        { output: 'abc', expected: false },
        { output: '', expected: false },
      ]

      for (const testCase of testCases) {
        const mockResult: Partial<ExecaReturnValue> = {
          stdout: testCase.output,
        }
        mockExeca.mockResolvedValue(
          mockResult as unknown as ReturnType<typeof execa>,
        )
        const result = await hasGlobalInstallation(`test-${testCase.output}`)
        expect(result).toBe(testCase.expected)
      }
    })

    it('应该处理空的 stdout', async () => {
      const mockResult: Partial<ExecaReturnValue> = {
        stdout: '',
        stderr: '',
      }

      mockExeca.mockResolvedValue(
        mockResult as unknown as ReturnType<typeof execa>,
      )

      const result = await hasGlobalInstallation('empty-output')

      expect(result).toBe(false)
    })

    it('应该处理包含多行的 stdout', async () => {
      const mockResult: Partial<ExecaReturnValue> = {
        stdout: `Some header info
v1.2.3
Some footer info`,
        stderr: '',
      }

      mockExeca.mockResolvedValue(
        mockResult as unknown as ReturnType<typeof execa>,
      )

      const result = await hasGlobalInstallation('multiline')

      expect(result).toBe(true)
    })
  })
})
