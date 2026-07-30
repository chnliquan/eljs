import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockedFunction,
} from 'vitest'
import * as importedModule0 from '../../src/file'
import * as importedModule1 from '../../src/type'

import { downloadNpmTarball } from '../../src/npm/download'
import download, { type DownloadOptions } from '../../src/npm/download-file'

const requiredModule0 = vi.mocked(importedModule0, { deep: true })
const requiredModule1 = vi.mocked(importedModule1, { deep: true })

// Mock 依赖项
vi.mock('../../src/npm/download-file')
vi.mock('../../src/file')
vi.mock('../../src/type')

describe('NPM Download 工具', () => {
  const mockDownload = download as MockedFunction<typeof download>
  const mockTmpdir = requiredModule0.tmpdir as unknown as MockedFunction<
    (random?: boolean) => Promise<string>
  >
  const mockIsObject = requiredModule1.isObject as MockedFunction<
    (value: unknown) => boolean
  >

  beforeEach(() => {
    vi.clearAllMocks()
    mockDownload.mockResolvedValue(Buffer.from('downloaded'))
    mockTmpdir.mockResolvedValue('/tmp/random-dir')
    mockIsObject.mockReturnValue(false)
  })

  describe('downloadNpmTarball', () => {
    it('应该下载到指定目录', async () => {
      const url = 'https://registry.npmjs.org/package/-/package-1.0.0.tgz'
      const dest = '/custom/destination'

      const result = await downloadNpmTarball(url, dest)

      expect(mockDownload).toHaveBeenCalledWith(url, dest, {
        extract: true,
        strip: 1,
        headers: { accept: 'application/tgz' },
      })
      expect(result).toBe(dest)
    })

    it('应该下载到临时目录', async () => {
      const url = 'https://registry.npmjs.org/temp/-/temp-2.0.0.tgz'

      const result = await downloadNpmTarball(url)

      expect(mockTmpdir).toHaveBeenCalledWith(true)
      expect(mockDownload).toHaveBeenCalledWith(
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
      expect(mockDownload).toHaveBeenCalledWith(
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
      mockDownload.mockRejectedValue(new Error('Network timeout'))

      await expect(
        downloadNpmTarball('https://fail.com/package.tgz'),
      ).rejects.toThrow(/Download .* failed.*Network timeout/)
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
      mockDownload.mockRejectedValue(originalError)

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
      expect(mockDownload).toHaveBeenCalledWith(
        'https://example.com/pkg.tgz',
        '/tmp/random-dir',
        expect.any(Object),
      )
    })

    it('应该处理 (url, dest) 重载', async () => {
      await downloadNpmTarball('https://example.com/pkg.tgz', '/dest')

      expect(mockTmpdir).not.toHaveBeenCalled()
      expect(mockDownload).toHaveBeenCalledWith(
        'https://example.com/pkg.tgz',
        '/dest',
        expect.any(Object),
      )
    })

    it('应该处理 (url, dest, options) 重载', async () => {
      await downloadNpmTarball('https://example.com/pkg.tgz', '/dest', {
        timeout: 8000,
      })

      expect(mockDownload).toHaveBeenCalledWith(
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

      expect(mockDownload).toHaveBeenCalledWith(
        'https://test.com/pkg.tgz',
        '/test',
        expect.objectContaining({
          timeout: 15000,
        }),
      )
    })
  })
})
