/* eslint-disable @typescript-eslint/no-var-requires */
import urllib from 'urllib'
import which from 'which'

import {
  getNpmPackage,
  getNpmPrefix,
  getNpmRegistry,
  getNpmUser,
  pkgNameAnalysis,
} from '../../src/npm/meta'

// Mock 依赖项
jest.mock('urllib')
jest.mock('which')
jest.mock('../../src/cp')
jest.mock('../../src/type')

describe('NPM Meta 工具', () => {
  const mockUrllib = urllib as jest.Mocked<typeof urllib>
  const mockWhich = which as jest.MockedFunction<typeof which>
  const mockRun = require('../../src/cp').run as jest.MockedFunction<
    (
      command: string,
      args: string[],
      options?: unknown,
    ) => Promise<{ stdout: string }>
  >
  const mockIsString = require('../../src/type')
    .isString as jest.MockedFunction<(value: unknown) => boolean>

  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.GLOBAL_PREFIX
    mockIsString.mockReturnValue(false)
    mockRun.mockResolvedValue({ stdout: 'https://registry.npmjs.org/' })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('getNpmRegistry', () => {
    it('应该获取 npm registry', async () => {
      mockRun.mockResolvedValue({ stdout: '  https://registry.npmjs.org/  \n' })

      const result = await getNpmRegistry()

      expect(mockRun).toHaveBeenCalledWith(
        'npm',
        ['config', 'get', 'registry'],
        undefined,
      )
      expect(result).toBe('https://registry.npmjs.org/')
    })

    it('应该传递选项', async () => {
      const options = { cwd: '/project' }
      mockRun.mockResolvedValue({ stdout: 'https://custom.registry.com/' })

      const result = await getNpmRegistry(options)

      expect(mockRun).toHaveBeenCalledWith(
        'npm',
        ['config', 'get', 'registry'],
        options,
      )
      expect(result).toBe('https://custom.registry.com/')
    })

    it('应该处理包含空格的输出', async () => {
      mockRun.mockResolvedValue({
        stdout: '\n  \t  https://registry.example.com  \t  \n',
      })

      const result = await getNpmRegistry()

      expect(result).toBe('https://registry.example.com')
    })
  })

  describe('getNpmUser', () => {
    it('应该获取当前 npm 用户', async () => {
      mockRun.mockResolvedValue({ stdout: '  username  \n' })

      const result = await getNpmUser()

      expect(mockRun).toHaveBeenCalledWith('npm', ['whoami'], undefined)
      expect(result).toBe('username')
    })

    it('应该传递选项', async () => {
      const options = { cwd: '/user-project' }
      mockRun.mockResolvedValue({ stdout: 'john-doe' })

      const result = await getNpmUser(options)

      expect(mockRun).toHaveBeenCalledWith('npm', ['whoami'], options)
      expect(result).toBe('john-doe')
    })

    it('应该处理空用户名', async () => {
      mockRun.mockResolvedValue({ stdout: '\n' })

      const result = await getNpmUser()

      expect(result).toBe('')
    })
  })

  describe('getNpmPackage', () => {
    const mockPackageData = {
      name: 'test-package',
      version: '1.0.0',
      description: 'Test package',
      dist: {
        shasum: 'abc123',
        size: 1024,
        tarball:
          'https://registry.npmjs.org/test-package/-/test-package-1.0.0.tgz',
      },
    }

    beforeEach(() => {
      mockRun.mockResolvedValue({ stdout: 'https://registry.npmjs.org/' })
      mockUrllib.request.mockResolvedValue({
        data: mockPackageData,
      } as unknown as ReturnType<typeof urllib.request>)
    })

    it('应该获取包信息', async () => {
      const result = await getNpmPackage('test-package')

      expect(mockRun).toHaveBeenCalledWith(
        'npm',
        ['config', 'get', 'registry'],
        { cwd: undefined },
      )
      expect(mockUrllib.request).toHaveBeenCalledWith(
        'https://registry.npmjs.org/test-package',
        { timeout: 10000, dataType: 'json' },
      )
      expect(result).toEqual(mockPackageData)
    })

    it('应该获取指定版本的包', async () => {
      await getNpmPackage('test-package', { version: '1.0.0' })

      expect(mockUrllib.request).toHaveBeenCalledWith(
        'https://registry.npmjs.org/test-package/1.0.0',
        { timeout: 10000, dataType: 'json' },
      )
    })

    it('应该使用自定义 registry', async () => {
      await getNpmPackage('custom-package', {
        registry: 'https://custom.registry.com/',
      })

      expect(mockRun).not.toHaveBeenCalled()
      expect(mockUrllib.request).toHaveBeenCalledWith(
        'https://custom.registry.com/custom-package',
        { timeout: 10000, dataType: 'json' },
      )
    })

    it('应该处理 scoped 包名', async () => {
      await getNpmPackage('@types/node')

      expect(mockUrllib.request).toHaveBeenCalledWith(
        'https://registry.npmjs.org/@types%2Fnode',
        { timeout: 10000, dataType: 'json' },
      )
    })

    it('应该处理自定义超时', async () => {
      await getNpmPackage('timeout-test', { timeout: 5000 })

      expect(mockUrllib.request).toHaveBeenCalledWith(
        'https://registry.npmjs.org/timeout-test',
        { timeout: 5000, dataType: 'json' },
      )
    })

    it('应该在包不存在时返回 null', async () => {
      mockUrllib.request.mockResolvedValue({
        data: { error: 'Not found' },
      } as unknown as ReturnType<typeof urllib.request>)

      const result = await getNpmPackage('nonexistent-package')

      expect(result).toBeNull()
    })

    it('应该在数据为字符串时返回 null', async () => {
      mockUrllib.request.mockResolvedValue({
        data: 'Not Found',
      } as unknown as ReturnType<typeof urllib.request>)
      mockIsString.mockReturnValue(true)

      const result = await getNpmPackage('string-response')

      expect(result).toBeNull()
    })

    it('应该在请求失败时返回 null', async () => {
      mockUrllib.request.mockRejectedValue(new Error('Network error'))

      const result = await getNpmPackage('network-fail-package')

      expect(result).toBeNull()
    })
  })

  describe('getNpmPrefix', () => {
    it('应该使用环境变量中的 GLOBAL_PREFIX', async () => {
      process.env.GLOBAL_PREFIX = '/custom/global/prefix'

      const result = await getNpmPrefix()

      expect(result).toBe('/custom/global/prefix')
      expect(mockRun).not.toHaveBeenCalled()
      expect(mockWhich).not.toHaveBeenCalled()
    })

    it('应该在 Windows 平台获取 npm prefix', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
      })

      mockRun.mockResolvedValue({
        stdout: '  C:\\Users\\user\\AppData\\Roaming\\npm  \n',
      })

      const result = await getNpmPrefix()

      expect(mockRun).toHaveBeenCalledWith('npm', ['prefix', '-g'])
      expect(result).toBe('C:\\Users\\user\\AppData\\Roaming\\npm')
      expect(process.env.GLOBAL_PREFIX).toBe(
        'C:\\Users\\user\\AppData\\Roaming\\npm',
      )
    })

    it('应该在非 Windows 平台使用 which node', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true,
      })

      mockWhich.mockResolvedValue('/usr/local/bin/node')

      const result = await getNpmPrefix()

      expect(mockWhich).toHaveBeenCalledWith('node')
      expect(result).toBe('/usr/local/')
    })

    it('应该在命令失败时使用默认值', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
      })

      mockRun.mockRejectedValue(new Error('npm not found'))

      const result = await getNpmPrefix()

      expect(result).toBe('usr/local')
    })

    it('应该缓存结果', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true,
      })

      mockWhich.mockResolvedValue('/opt/node/bin/node')

      const result1 = await getNpmPrefix()
      const result2 = await getNpmPrefix()

      expect(result1).toBe('/opt/node/')
      expect(result2).toBe('/opt/node/')
      expect(mockWhich).toHaveBeenCalledTimes(1) // 第二次使用缓存
    })
  })

  describe('pkgNameAnalysis', () => {
    it('应该解析简单包名', () => {
      const result = pkgNameAnalysis('lodash')

      expect(result).toEqual({
        name: 'lodash',
        version: 'latest',
        scope: '',
        unscopedName: 'lodash',
      })
    })

    it('应该解析带版本的包名', () => {
      const result = pkgNameAnalysis('react@18.2.0')

      expect(result).toEqual({
        name: 'react',
        version: '18.2.0',
        scope: '',
        unscopedName: 'react',
      })
    })

    it('应该解析 scoped 包名', () => {
      const result = pkgNameAnalysis('@types/node')

      expect(result).toEqual({
        name: '@types/node',
        version: 'latest',
        scope: '@types',
        unscopedName: 'node',
      })
    })

    it('应该解析 scoped 包名带版本', () => {
      const result = pkgNameAnalysis('@babel/core@7.20.0')

      expect(result).toEqual({
        name: '@babel/core',
        version: '7.20.0',
        scope: '@babel',
        unscopedName: 'core',
      })
    })

    it('应该处理预发布版本', () => {
      const result = pkgNameAnalysis('package@1.0.0-alpha.1')

      expect(result).toEqual({
        name: 'package',
        version: '1.0.0-alpha.1',
        scope: '',
        unscopedName: 'package',
      })
    })

    it('应该处理复杂版本范围', () => {
      const cases = [
        'package@~1.2.3',
        'package@^2.0.0',
        '@scope/pkg@>=1.0.0',
        'test@latest',
      ]

      cases.forEach(pkg => {
        const result = pkgNameAnalysis(pkg)
        expect(typeof result.name).toBe('string')
        expect(typeof result.version).toBe('string')
      })
    })

    it('应该处理解析错误', () => {
      const result = pkgNameAnalysis('')

      expect(result).toEqual({
        name: '',
        version: 'latest',
        scope: '',
        unscopedName: '',
      })
    })
  })

  describe('类型安全验证', () => {
    it('应该返回正确类型', () => {
      const result = pkgNameAnalysis('@scope/package@1.0.0')

      expect(typeof result.name).toBe('string')
      expect(typeof result.version).toBe('string')
      expect(typeof result.scope).toBe('string')
      expect(typeof result.unscopedName).toBe('string')
    })
  })
})
