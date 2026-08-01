import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockedFunction,
} from 'vitest'
import * as importedModule0 from '../../src/file'
import * as importedModule1 from '../../src/guards'

import { downloadTo, type DownloadOptions } from '../../src/http/download'
import { downloadNpmTarball } from '../../src/npm/download-npm-tarball'

const requiredModule0 = vi.mocked(importedModule0, { deep: true })
const requiredModule1 = vi.mocked(importedModule1, { deep: true })

// Mock 依赖项
vi.mock('../../src/http/download')
vi.mock('../../src/file')
vi.mock('../../src/guards')

describe('NPM Download 工具', () => {
  const mockDownloadTo = downloadTo as MockedFunction<typeof downloadTo>
  const mockTmpdir = requiredModule0.createTempDir as unknown as MockedFunction<
    (random?: boolean) => Promise<string>
  >
  const mockRemove = requiredModule0.remove as MockedFunction<
    typeof importedModule0.remove
  >
  const mockIsObject = requiredModule1.isObject as MockedFunction<
    (value: unknown) => boolean
  >

  beforeEach(() => {
    vi.clearAllMocks()
    mockDownloadTo.mockResolvedValue(undefined)
    mockTmpdir.mockResolvedValue('/tmp/random-dir')
    mockRemove.mockResolvedValue(true)
    mockIsObject.mockReturnValue(false)
  })

  describe('downloadNpmTarball', () => {
    it('应该下载到指定目录', async () => {
      const url = 'https://registry.npmjs.org/package/-/package-1.0.0.tgz'
      const dest = '/custom/destination'

      const result = await downloadNpmTarball(url, dest)

      expect(mockDownloadTo).toHaveBeenCalledWith(
        url,
        dest,
        expect.objectContaining({ extract: true, strip: 1 }),
      )
      const headers = mockDownloadTo.mock.calls[0][2]?.headers as Headers
      expect(headers.get('accept')).toBe('application/tgz')
      expect(result).toBe(dest)
    })

    it('应该下载到临时目录', async () => {
      const url = 'https://registry.npmjs.org/temp/-/temp-2.0.0.tgz'

      const result = await downloadNpmTarball(url)

      expect(mockTmpdir).toHaveBeenCalledWith(true)
      expect(mockDownloadTo).toHaveBeenCalledWith(
        url,
        '/tmp/random-dir',
        expect.any(Object),
      )
      expect(result).toBe('/tmp/random-dir')
    })

    it('应该处理选项作为第二个参数', async () => {
      const url = 'https://registry.npmjs.org/opts/-/opts-1.0.0.tgz'
      const options: DownloadOptions = { timeout: 5000 }

      mockIsObject.mockReturnValue(true)

      const result = await downloadNpmTarball(url, options)

      expect(mockTmpdir).toHaveBeenCalledWith(true)
      expect(mockDownloadTo).toHaveBeenCalledWith(
        url,
        '/tmp/random-dir',
        expect.objectContaining({
          timeout: 5000,
          extract: true,
          strip: 1,
        }),
      )
      expect(result).toBe('/tmp/random-dir')
    })

    it('应该处理下载失败', async () => {
      mockDownloadTo.mockRejectedValue(new Error('Network timeout'))

      await expect(
        downloadNpmTarball('https://fail.com/package.tgz'),
      ).rejects.toThrow(/Download .* failed.*Network timeout/)
      expect(mockRemove).toHaveBeenCalledWith('/tmp/random-dir')
    })

    it('下载到调用方指定目录失败时不应该删除该目录', async () => {
      mockDownloadTo.mockRejectedValue(new Error('Network timeout'))

      await expect(
        downloadNpmTarball(
          'https://fail.com/package.tgz',
          '/custom/destination',
        ),
      ).rejects.toThrow('Network timeout')
      expect(mockRemove).not.toHaveBeenCalled()
    })

    it('应该处理临时目录创建失败', async () => {
      mockTmpdir.mockRejectedValue(new Error('Cannot create temp dir'))

      await expect(
        downloadNpmTarball('https://example.com/test.tgz'),
      ).rejects.toThrow('Cannot create temp dir')
    })

    it('应该处理空字符串目标路径', async () => {
      const result = await downloadNpmTarball(
        'https://example.com/test.tgz',
        '',
      )

      expect(mockTmpdir).toHaveBeenCalledWith(true)
      expect(result).toBe('/tmp/random-dir')
    })

    it('应该处理错误消息格式', async () => {
      const originalError = new Error('Download failed: 404')
      mockDownloadTo.mockRejectedValue(originalError)

      try {
        await downloadNpmTarball('https://fail.com/package.tgz')
        throw new Error('应该抛出错误')
      } catch (error) {
        expect((error as Error).message).toMatch(
          /Download https:\/\/fail\.com\/package\.tgz failed: Download failed: 404/,
        )
      }
    })
  })

  describe('参数重载', () => {
    it('应该处理 (url) 重载', async () => {
      await downloadNpmTarball('https://example.com/pkg.tgz')

      expect(mockTmpdir).toHaveBeenCalledWith(true)
      expect(mockDownloadTo).toHaveBeenCalledWith(
        'https://example.com/pkg.tgz',
        '/tmp/random-dir',
        expect.any(Object),
      )
    })

    it('应该处理 (url, dest) 重载', async () => {
      await downloadNpmTarball('https://example.com/pkg.tgz', '/dest')

      expect(mockTmpdir).not.toHaveBeenCalled()
      expect(mockDownloadTo).toHaveBeenCalledWith(
        'https://example.com/pkg.tgz',
        '/dest',
        expect.any(Object),
      )
    })

    it('应该处理 (url, dest, options) 重载', async () => {
      await downloadNpmTarball('https://example.com/pkg.tgz', '/dest', {
        timeout: 8000,
      })

      expect(mockDownloadTo).toHaveBeenCalledWith(
        'https://example.com/pkg.tgz',
        '/dest',
        expect.objectContaining({
          timeout: 8000,
        }),
      )
    })
  })

  describe('类型安全', () => {
    it('应该保持正确的返回类型', async () => {
      const result = await downloadNpmTarball('https://example.com/test.tgz')

      expect(typeof result).toBe('string')
      expect(result).toBe('/tmp/random-dir')
    })

    it('应该处理各种选项类型', async () => {
      const options: DownloadOptions = {
        timeout: 15000,
        headers: { custom: 'header' },
      }

      await downloadNpmTarball('https://test.com/pkg.tgz', '/test', options)

      expect(mockDownloadTo).toHaveBeenCalledWith(
        'https://test.com/pkg.tgz',
        '/test',
        expect.objectContaining({
          timeout: 15000,
        }),
      )
      const headers = mockDownloadTo.mock.calls[0][2]?.headers as Headers
      expect(headers.get('accept')).toBe('application/tgz')
      expect(headers.get('custom')).toBe('header')
    })
  })
})
