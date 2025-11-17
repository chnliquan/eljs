/* eslint-disable @typescript-eslint/naming-convention */
/**
 * @file packages/release utils/npm 模块单元测试
 * @description 测试 npm.ts 的 npm 相关工具函数
 */

import { getNpmPackage, logger, run } from '@eljs/utils'
import resolveBin from 'resolve-bin'

import {
  getRemoteDistTag,
  syncCnpm,
  type RemoteDistTag,
} from '../../src/utils/npm'

// 模拟依赖
jest.mock('@eljs/utils', () => ({
  chalk: {
    cyan: jest.fn((text: string) => `[cyan]${text}[/cyan]`),
  },
  getNpmPackage: jest.fn(),
  logger: {
    ready: jest.fn(),
  },
  run: jest.fn(),
}))

jest.mock('resolve-bin', () => ({
  sync: jest.fn(),
}))

describe('NPM 工具函数测试', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getRemoteDistTag 函数', () => {
    test('应该正确获取远程 dist tag', async () => {
      const mockNpmMeta = {
        'dist-tags': {
          latest: '1.0.0',
          alpha: '1.1.0-alpha.1',
          beta: '1.1.0-beta.1',
          rc: '1.1.0-rc.1',
        },
      }

      ;(getNpmPackage as jest.Mock).mockResolvedValue(mockNpmMeta)

      const result = await getRemoteDistTag(['test-package'])

      expect(result).toEqual({
        latest: '1.0.0',
        alpha: '1.1.0-alpha.1',
        beta: '1.1.0-beta.1',
        rc: '1.1.0-rc.1',
      })
      expect(getNpmPackage).toHaveBeenCalledWith('test-package', undefined)
    })

    test('应该使用指定的选项', async () => {
      const mockNpmMeta = {
        'dist-tags': {
          latest: '2.0.0',
          alpha: '2.1.0-alpha.1',
          beta: '2.1.0-beta.1',
          rc: '2.1.0-rc.1',
        },
      }

      const options = {
        cwd: '/custom/path',
        registry: 'https://custom-registry.com',
      }

      ;(getNpmPackage as jest.Mock).mockResolvedValue(mockNpmMeta)

      const result = await getRemoteDistTag(['test-package'], options)

      expect(getNpmPackage).toHaveBeenCalledWith('test-package', options)
      expect(result).toEqual({
        latest: '2.0.0',
        alpha: '2.1.0-alpha.1',
        beta: '2.1.0-beta.1',
        rc: '2.1.0-rc.1',
      })
    })

    test('应该处理多个包名，返回第一个有效的', async () => {
      const mockNpmMeta2 = {
        'dist-tags': {
          latest: '1.5.0',
          alpha: '1.6.0-alpha.1',
          beta: '1.6.0-beta.1',
          rc: '1.6.0-rc.1',
        },
      }

      ;(getNpmPackage as jest.Mock)
        .mockResolvedValueOnce(null) // 第一个包不存在
        .mockResolvedValueOnce(mockNpmMeta2) // 第二个包存在

      const result = await getRemoteDistTag([
        'non-existent-package',
        'test-package-2',
      ])

      expect(getNpmPackage).toHaveBeenCalledTimes(2)
      expect(getNpmPackage).toHaveBeenNthCalledWith(
        1,
        'non-existent-package',
        undefined,
      )
      expect(getNpmPackage).toHaveBeenNthCalledWith(
        2,
        'test-package-2',
        undefined,
      )
      expect(result).toEqual({
        latest: '1.5.0',
        alpha: '1.6.0-alpha.1',
        beta: '1.6.0-beta.1',
        rc: '1.6.0-rc.1',
      })
    })

    test('应该处理没有 dist-tags 的包', async () => {
      const mockNpmMeta = {
        name: 'test-package',
        version: '1.0.0',
        // 没有 dist-tags 字段
      }

      ;(getNpmPackage as jest.Mock).mockResolvedValue(mockNpmMeta)

      const result = await getRemoteDistTag(['test-package'])

      expect(result).toEqual({
        latest: '',
        alpha: '',
        beta: '',
        rc: '',
      })
    })

    test('应该处理所有包都不存在的情况', async () => {
      ;(getNpmPackage as jest.Mock).mockResolvedValue(null)

      const result = await getRemoteDistTag([
        'non-existent-1',
        'non-existent-2',
      ])

      expect(result).toEqual({
        latest: '',
        alpha: '',
        beta: '',
        rc: '',
      })
    })

    test('应该处理空包名数组', async () => {
      const result = await getRemoteDistTag([])

      expect(result).toEqual({
        latest: '',
        alpha: '',
        beta: '',
        rc: '',
      })
      expect(getNpmPackage).not.toHaveBeenCalled()
    })

    test('应该正确处理部分 dist-tags', async () => {
      const mockNpmMeta = {
        'dist-tags': {
          latest: '1.0.0',
          // 缺少 alpha, beta, rc
        },
      }

      ;(getNpmPackage as jest.Mock).mockResolvedValue(mockNpmMeta)

      const result = await getRemoteDistTag(['test-package'])

      expect(result).toEqual({
        latest: '1.0.0',
        alpha: undefined,
        beta: undefined,
        rc: undefined,
      })
    })
  })

  describe('syncCnpm 函数', () => {
    test('应该正确同步单个包到 cnpm', async () => {
      ;(resolveBin.sync as jest.Mock).mockReturnValue('/usr/bin/cnpm')
      ;(run as jest.Mock).mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      })

      const result = await syncCnpm(['test-package'])

      expect(resolveBin.sync).toHaveBeenCalledWith('cnpm')
      expect(run).toHaveBeenCalledWith('/usr/bin/cnpm', [
        'sync',
        'test-package',
      ])
      expect(logger.ready).toHaveBeenCalledWith(
        'Sync [cyan]test-package[/cyan] to cnpm.',
      )
      expect(result).toHaveLength(1)
      expect(result[0].status).toBe('fulfilled')
    })

    test('应该正确同步多个包到 cnpm', async () => {
      const packages = ['package-1', 'package-2', 'package-3']

      ;(resolveBin.sync as jest.Mock).mockReturnValue('/usr/local/bin/cnpm')
      ;(run as jest.Mock).mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      })

      const result = await syncCnpm(packages)

      expect(run).toHaveBeenCalledTimes(3)
      expect(run).toHaveBeenNthCalledWith(1, '/usr/local/bin/cnpm', [
        'sync',
        'package-1',
      ])
      expect(run).toHaveBeenNthCalledWith(2, '/usr/local/bin/cnpm', [
        'sync',
        'package-2',
      ])
      expect(run).toHaveBeenNthCalledWith(3, '/usr/local/bin/cnpm', [
        'sync',
        'package-3',
      ])

      expect(logger.ready).toHaveBeenCalledTimes(3)
      expect(logger.ready).toHaveBeenNthCalledWith(
        1,
        'Sync [cyan]package-1[/cyan] to cnpm.',
      )
      expect(logger.ready).toHaveBeenNthCalledWith(
        2,
        'Sync [cyan]package-2[/cyan] to cnpm.',
      )
      expect(logger.ready).toHaveBeenNthCalledWith(
        3,
        'Sync [cyan]package-3[/cyan] to cnpm.',
      )

      expect(result).toHaveLength(3)
      result.forEach(item => {
        expect(item.status).toBe('fulfilled')
      })
    })

    test('应该并发执行同步操作', async () => {
      const packages = ['package-1', 'package-2']
      let runCallCount = 0

      ;(resolveBin.sync as jest.Mock).mockReturnValue('/usr/bin/cnpm')
      ;(run as jest.Mock).mockImplementation(async () => {
        runCallCount++
        await new Promise(resolve => setTimeout(resolve, 10))
        return { stdout: '', stderr: '', exitCode: 0 }
      })

      const startTime = Date.now()
      await syncCnpm(packages)
      const endTime = Date.now()

      expect(runCallCount).toBe(2)
      // 并发执行应该比串行执行快
      expect(endTime - startTime).toBeLessThan(50) // 应该远小于 20ms
    })

    test('应该处理单个包同步失败的情况', async () => {
      const packages = ['success-package', 'fail-package']

      ;(resolveBin.sync as jest.Mock).mockReturnValue('/usr/bin/cnpm')
      ;(run as jest.Mock)
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
        .mockRejectedValueOnce(new Error('同步失败'))

      const result = await syncCnpm(packages)

      expect(result).toHaveLength(2)
      expect(result[0].status).toBe('fulfilled')
      expect(result[1].status).toBe('rejected')

      // 成功的包应该记录日志
      expect(logger.ready).toHaveBeenCalledWith(
        'Sync [cyan]success-package[/cyan] to cnpm.',
      )
      // 失败的包不应该记录成功日志
      expect(logger.ready).not.toHaveBeenCalledWith(
        'Sync [cyan]fail-package[/cyan] to cnpm.',
      )
    })

    test('应该处理空包名数组', async () => {
      const result = await syncCnpm([])

      expect(result).toHaveLength(0)
      expect(resolveBin.sync).toHaveBeenCalledWith('cnpm')
      expect(run).not.toHaveBeenCalled()
      expect(logger.ready).not.toHaveBeenCalled()
    })

    test('应该处理 resolveBin 失败的情况', () => {
      ;(resolveBin.sync as jest.Mock).mockImplementation(() => {
        throw new Error('cnpm not found')
      })

      expect(() => syncCnpm(['test-package'])).rejects.toThrow('cnpm not found')
    })

    test('应该使用正确的 cnpm 命令路径', async () => {
      const cnpmPath = '/custom/path/to/cnpm'
      ;(resolveBin.sync as jest.Mock).mockReturnValue(cnpmPath)
      ;(run as jest.Mock).mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      })

      await syncCnpm(['test-package'])

      expect(run).toHaveBeenCalledWith(cnpmPath, ['sync', 'test-package'])
    })
  })

  describe('RemoteDistTag 类型验证', () => {
    test('应该匹配 RemoteDistTag 接口', async () => {
      const mockNpmMeta = {
        'dist-tags': {
          latest: '1.0.0',
          alpha: '1.1.0-alpha.1',
          beta: '1.1.0-beta.1',
          rc: '1.1.0-rc.1',
        },
      }

      ;(getNpmPackage as jest.Mock).mockResolvedValue(mockNpmMeta)

      const result: RemoteDistTag = await getRemoteDistTag(['test-package'])

      // 类型检查
      expect(typeof result.latest).toBe('string')
      expect(typeof result.alpha).toBe('string')
      expect(typeof result.beta).toBe('string')
      expect(typeof result.rc).toBe('string')

      expect(result).toEqual({
        latest: '1.0.0',
        alpha: '1.1.0-alpha.1',
        beta: '1.1.0-beta.1',
        rc: '1.1.0-rc.1',
      })
    })
  })
})
