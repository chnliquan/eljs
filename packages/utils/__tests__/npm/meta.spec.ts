import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mocked,
  type MockedFunction,
} from 'vitest'
import * as importedModule0 from '../../src/cp'
import * as importedModule1 from '../../src/guards'
import * as importedModule2 from '../../src/npm/request-config'

import urllib, { ProxyAgent } from 'urllib'
import which from 'which'

import { getNpmPrefix } from '../../src/npm/global-prefix'
import { getNpmPackage } from '../../src/npm/package-metadata'
import { parsePackageSpecifier } from '../../src/npm/package-specifier'
import { getNpmRegistry, getNpmUser } from '../../src/npm/registry-cli'

const requiredModule0 = vi.mocked(importedModule0, { deep: true })
const requiredModule1 = vi.mocked(importedModule1, { deep: true })
const requiredModule2 = vi.mocked(importedModule2, { deep: true })

// Mock 依赖项
vi.mock('urllib')
vi.mock('which')
vi.mock('../../src/cp')
vi.mock('../../src/guards')
vi.mock('../../src/npm/request-config')

describe('NPM Meta 工具', () => {
  const mockUrllib = urllib as Mocked<typeof urllib>
  const mockWhich = which as MockedFunction<typeof which>
  const mockRun = requiredModule0.run as MockedFunction<
    (
      command: string,
      args: string[],
      options?: unknown,
    ) => Promise<{ stdout: string }>
  >
  const mockIsString = requiredModule1.isString as MockedFunction<
    (value: unknown) => boolean
  >
  const mockGetNpmRequestConfig = requiredModule2.getNpmRequestConfig

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.GLOBAL_PREFIX
    mockIsString.mockReturnValue(false)
    mockGetNpmRequestConfig.mockResolvedValue({})
    mockRun.mockResolvedValue({ stdout: 'https://registry.npmjs.org/' })
  })

  afterEach(() => {
    vi.restoreAllMocks()
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
        status: 200,
      } as unknown as Awaited<ReturnType<typeof urllib.request>>)
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

      expect(mockRun).toHaveBeenCalledWith(
        'npm',
        ['config', 'get', '@types:registry'],
        { cwd: undefined },
      )
      expect(mockUrllib.request).toHaveBeenCalledWith(
        'https://registry.npmjs.org/@types%2Fnode',
        { timeout: 10000, dataType: 'json' },
      )
    })

    it('应该在 scoped registry 未配置时回退到默认 registry', async () => {
      mockRun
        .mockResolvedValueOnce({ stdout: 'undefined\n' })
        .mockResolvedValueOnce({ stdout: 'https://registry.example.com/' })

      await getNpmPackage('@scope/package')

      expect(mockRun).toHaveBeenNthCalledWith(
        1,
        'npm',
        ['config', 'get', '@scope:registry'],
        { cwd: undefined },
      )
      expect(mockRun).toHaveBeenNthCalledWith(
        2,
        'npm',
        ['config', 'get', 'registry'],
        { cwd: undefined },
      )
      expect(mockUrllib.request).toHaveBeenCalledWith(
        'https://registry.example.com/@scope%2Fpackage',
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

    it('应该仅把目标 registry 的认证请求头传给客户端', async () => {
      mockGetNpmRequestConfig.mockResolvedValue({
        headers: { authorization: 'Bearer private-token' },
      })

      await getNpmPackage('private-package')

      expect(mockGetNpmRequestConfig).toHaveBeenCalledWith(
        'https://registry.npmjs.org/private-package',
        undefined,
      )
      expect(mockUrllib.request).toHaveBeenCalledWith(
        'https://registry.npmjs.org/private-package',
        {
          dataType: 'json',
          headers: { authorization: 'Bearer private-token' },
          timeout: 10000,
        },
      )
    })

    it('应该在包不存在时返回 null', async () => {
      mockUrllib.request.mockResolvedValue({
        data: { error: 'Not found' },
        status: 404,
      } as unknown as Awaited<ReturnType<typeof urllib.request>>)

      const result = await getNpmPackage('nonexistent-package')

      expect(result).toBeNull()
    })

    it('应该拒绝成功状态下的无效响应结构', async () => {
      mockUrllib.request.mockResolvedValue({
        data: 'Not Found',
        status: 200,
      } as unknown as Awaited<ReturnType<typeof urllib.request>>)
      mockIsString.mockReturnValue(true)

      await expect(getNpmPackage('string-response')).rejects.toMatchObject({
        code: 'ERR_NPM_REGISTRY_RESPONSE',
        operation: 'npm.getPackage',
      })
    })

    it('应该保留 registry HTTP 状态错误', async () => {
      mockUrllib.request.mockResolvedValue({
        data: { error: 'Unauthorized' },
        status: 401,
      } as unknown as Awaited<ReturnType<typeof urllib.request>>)

      await expect(getNpmPackage('private-package')).rejects.toMatchObject({
        code: 'ERR_NPM_REGISTRY_HTTP_STATUS',
        details: { packageName: 'private-package', status: 401 },
      })
    })

    it('应该在请求失败时抛出稳定错误', async () => {
      mockUrllib.request.mockRejectedValue(new Error('Network error'))

      await expect(getNpmPackage('network-fail-package')).rejects.toMatchObject(
        {
          code: 'ERR_NPM_REGISTRY_REQUEST',
          operation: 'npm.getPackage',
        },
      )
    })

    it('应该在请求结束后关闭代理调度器', async () => {
      const close = vi.fn().mockResolvedValue(undefined)
      vi.mocked(ProxyAgent).mockImplementation(function MockProxyAgent() {
        return { close }
      } as unknown as typeof ProxyAgent)
      mockGetNpmRequestConfig.mockResolvedValue({
        proxy: 'http://proxy.example.com:8080',
      })

      await getNpmPackage('proxied-package')

      expect(close).toHaveBeenCalledOnce()
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

  describe('parsePackageSpecifier', () => {
    it('应该解析简单包名', () => {
      const result = parsePackageSpecifier('lodash')

      expect(result).toEqual({
        name: 'lodash',
        version: 'latest',
        scope: '',
        unscopedName: 'lodash',
      })
    })

    it('应该解析带版本的包名', () => {
      const result = parsePackageSpecifier('react@18.2.0')

      expect(result).toEqual({
        name: 'react',
        version: '18.2.0',
        scope: '',
        unscopedName: 'react',
      })
    })

    it('应该解析 scoped 包名', () => {
      const result = parsePackageSpecifier('@types/node')

      expect(result).toEqual({
        name: '@types/node',
        version: 'latest',
        scope: '@types',
        unscopedName: 'node',
      })
    })

    it('应该解析 scoped 包名带版本', () => {
      const result = parsePackageSpecifier('@babel/core@7.20.0')

      expect(result).toEqual({
        name: '@babel/core',
        version: '7.20.0',
        scope: '@babel',
        unscopedName: 'core',
      })
    })

    it('应该处理预发布版本', () => {
      const result = parsePackageSpecifier('package@1.0.0-alpha.1')

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
        const result = parsePackageSpecifier(pkg)
        expect(typeof result.name).toBe('string')
        expect(typeof result.version).toBe('string')
      })
    })

    it('应该处理解析错误', () => {
      const result = parsePackageSpecifier('')

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
      const result = parsePackageSpecifier('@scope/package@1.0.0')

      expect(typeof result.name).toBe('string')
      expect(typeof result.version).toBe('string')
      expect(typeof result.scope).toBe('string')
      expect(typeof result.unscopedName).toBe('string')
    })
  })
})
