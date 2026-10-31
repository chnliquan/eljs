import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
  type Mocked,
  type MockedFunction,
} from 'vitest'
import * as importedModule0 from '../../src/cp'
import * as importedModule2 from '../../src/npm/request-config'

import { Readable } from 'node:stream'
import urllib, { ProxyAgent } from 'urllib'
import which from 'which'

import { getNpmPrefix } from '../../src/npm/global-prefix'
import {
  getNpmPackage,
  type NpmPackage,
  type NpmPackageQueryOptions,
  type NpmPackageVersionQueryOptions,
} from '../../src/npm/package-metadata'
import { parsePackageSpecifier } from '../../src/npm/package-specifier'
import { getNpmRegistry, getNpmUser } from '../../src/npm/registry-cli'

const requiredModule0 = vi.mocked(importedModule0, { deep: true })
const requiredModule2 = vi.mocked(importedModule2, { deep: true })

// Mock 依赖项
vi.mock('urllib')
vi.mock('which')
vi.mock('../../src/cp')
vi.mock('../../src/npm/request-config')

describe('NPM Meta 工具', () => {
  const mockUrllib = urllib as Mocked<typeof urllib>
  const mockWhich = which as MockedFunction<typeof which>
  const mockRun = requiredModule0.run as unknown as MockedFunction<
    (
      command: string,
      args: string[],
      options?: unknown,
    ) => Promise<{ stdout: string }>
  >
  const mockGetNpmRequestConfig = requiredModule2.getNpmRequestConfig

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.GLOBAL_PREFIX
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
        shasum: 'a'.repeat(40),
        size: 1024,
        tarball:
          'https://registry.npmjs.org/test-package/-/test-package-1.0.0.tgz',
      },
      versions: {},
      'dist-tags': {},
    }

    beforeEach(() => {
      mockRun.mockResolvedValue({ stdout: 'https://registry.npmjs.org/' })
      mockUrllib.request.mockImplementation(
        async url =>
          ({
            res: Readable.from([
              JSON.stringify({
                ...mockPackageData,
                name: decodeURIComponent(
                  new URL(String(url)).pathname.split('/')[1],
                ),
              }),
            ]),
            headers: {},
            status: 200,
          }) as unknown as Awaited<ReturnType<typeof urllib.request>>,
      )
    })

    it('应该获取包信息', async () => {
      const result = await getNpmPackage('test-package')

      expect(mockRun).toHaveBeenCalledWith(
        'npm',
        ['config', 'get', 'registry'],
        { cwd: undefined, signal: expect.any(AbortSignal) },
      )
      expect(mockUrllib.request).toHaveBeenCalledWith(
        'https://registry.npmjs.org/test-package',
        expect.objectContaining({
          timeout: [0, 0],
          dataType: 'stream',
          followRedirect: false,
        }),
      )
      expect(result).toEqual(mockPackageData)
    })

    it('应该获取指定版本的包', async () => {
      await getNpmPackage('test-package', { version: '1.0.0' })

      expect(mockUrllib.request).toHaveBeenCalledWith(
        'https://registry.npmjs.org/test-package/1.0.0',
        expect.objectContaining({
          timeout: [0, 0],
          dataType: 'stream',
          followRedirect: false,
        }),
      )
    })

    it('应根据选项变量或字面量推导包级与版本级返回类型', async () => {
      const versionOptions: NpmPackageVersionQueryOptions = {
        version: '1.0.0',
      }
      const packageOptions: NpmPackageQueryOptions = {}
      const version = await getNpmPackage('test-package', versionOptions)
      const literal = await getNpmPackage('test-package', { version: '1.0.0' })
      const metadata = await getNpmPackage('test-package', packageOptions)
      const defaultMetadata = await getNpmPackage('test-package')

      expectTypeOf(version).toEqualTypeOf<
        NpmPackage['versions'][string] | null
      >()
      expectTypeOf(literal).toEqualTypeOf<typeof version>()
      expectTypeOf(metadata).toEqualTypeOf<NpmPackage | null>()
      expectTypeOf(defaultMetadata).toEqualTypeOf<typeof metadata>()
      expect(version?.version).toBe('1.0.0')
      expect(mockUrllib.request).toHaveBeenCalledWith(
        'https://registry.npmjs.org/test-package/1.0.0',
        expect.objectContaining({
          timeout: [0, 0],
          dataType: 'stream',
          followRedirect: false,
        }),
      )
    })

    it('应该将版本或 dist-tag 作为单个 URL 路径段编码', async () => {
      await getNpmPackage('test-package', { version: 'preview/next value' })

      expect(mockUrllib.request).toHaveBeenCalledWith(
        'https://registry.npmjs.org/test-package/preview%2Fnext%20value',
        expect.objectContaining({
          timeout: [0, 0],
          dataType: 'stream',
          followRedirect: false,
        }),
      )
    })

    it('应该使用自定义 registry', async () => {
      await getNpmPackage('custom-package', {
        registry: 'https://custom.registry.com/',
      })

      expect(mockRun).not.toHaveBeenCalled()
      expect(mockUrllib.request).toHaveBeenCalledWith(
        'https://custom.registry.com/custom-package',
        expect.objectContaining({
          timeout: [0, 0],
          dataType: 'stream',
          followRedirect: false,
        }),
      )
    })

    it('应该处理 scoped 包名', async () => {
      await getNpmPackage('@types/node')

      expect(mockRun).toHaveBeenCalledWith(
        'npm',
        ['config', 'get', '@types:registry'],
        { cwd: undefined, signal: expect.any(AbortSignal) },
      )
      expect(mockUrllib.request).toHaveBeenCalledWith(
        'https://registry.npmjs.org/@types%2Fnode',
        expect.objectContaining({
          timeout: [0, 0],
          dataType: 'stream',
          followRedirect: false,
        }),
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
        { cwd: undefined, signal: expect.any(AbortSignal) },
      )
      expect(mockRun).toHaveBeenNthCalledWith(
        2,
        'npm',
        ['config', 'get', 'registry'],
        { cwd: undefined, signal: expect.any(AbortSignal) },
      )
      expect(mockUrllib.request).toHaveBeenCalledWith(
        'https://registry.example.com/@scope%2Fpackage',
        expect.objectContaining({
          timeout: [0, 0],
          dataType: 'stream',
          followRedirect: false,
        }),
      )
    })

    it('应该使用独立总超时而关闭客户端 idle 超时', async () => {
      await getNpmPackage('timeout-test', { timeout: 5000 })

      expect(mockUrllib.request).toHaveBeenCalledWith(
        'https://registry.npmjs.org/timeout-test',
        expect.objectContaining({
          timeout: [0, 0],
          dataType: 'stream',
          followRedirect: false,
        }),
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
        expect.objectContaining({
          dataType: 'stream',
          headers: {
            accept: 'application/json',
            authorization: 'Bearer private-token',
          },
          timeout: [0, 0],
          followRedirect: false,
        }),
      )
    })

    it('应该在包不存在时返回 null', async () => {
      mockUrllib.request.mockResolvedValue({
        res: Readable.from(['{"error":"Not found"}']),
        headers: {},
        status: 404,
      } as unknown as Awaited<ReturnType<typeof urllib.request>>)

      const result = await getNpmPackage('nonexistent-package')

      expect(result).toBeNull()
    })

    it('应该拒绝成功状态下的无效响应结构', async () => {
      mockUrllib.request.mockResolvedValue({
        res: Readable.from(['"Not Found"']),
        headers: {},
        status: 200,
      } as unknown as Awaited<ReturnType<typeof urllib.request>>)

      await expect(getNpmPackage('string-response')).rejects.toMatchObject({
        code: 'ERR_NPM_REGISTRY_RESPONSE',
        operation: 'npm.getPackage',
      })
    })

    it('应该保留 registry HTTP 状态错误', async () => {
      mockUrllib.request.mockResolvedValue({
        res: Readable.from(['{"error":"Unauthorized"}']),
        headers: {},
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

    it.each([
      'caller stopped',
      Object.freeze(new Error('frozen caller stopped')),
      new Error('caller stopped'),
    ])('应隔离客户端对取消原因的写入：%s', async reason => {
      const controller = new AbortController()
      const original =
        typeof reason === 'string'
          ? undefined
          : Object.getOwnPropertyDescriptors(reason)
      let transportSignal: AbortSignal | undefined
      let configurationSignal: AbortSignal | undefined
      let removeListener: ReturnType<typeof vi.spyOn> | undefined
      mockUrllib.request.mockImplementationOnce(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            transportSignal = options?.signal as AbortSignal | undefined
            configurationSignal = (
              mockRun.mock.calls[0][2] as { signal: AbortSignal }
            ).signal
            removeListener = vi.spyOn(
              configurationSignal,
              'removeEventListener',
            )
            transportSignal?.addEventListener(
              'abort',
              () => {
                const transportReason = transportSignal?.reason
                Object.assign(transportReason, {
                  opaque: 'client state',
                  res: {},
                  socket: {},
                })
                reject(transportReason)
              },
              { once: true },
            )
            controller.abort(reason)
          }),
      )
      const error = await getNpmPackage('test-package', {
        signal: controller.signal,
        timeout: 0,
      }).catch((error: unknown) => error)
      expect(error).toMatchObject({ code: 'ERR_NPM_REGISTRY_REQUEST' })
      expect((error as Error).cause).toBe(reason)
      expect(transportSignal).not.toBe(configurationSignal)
      expect(transportSignal?.reason).toBeInstanceOf(Error)
      expect(transportSignal?.reason).not.toBe(reason)
      expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function))
      expect(controller.signal.reason).toBe(reason)
      if (typeof reason !== 'string') {
        expect(Object.getOwnPropertyDescriptors(reason)).toEqual(original)
      }
    })

    it.each([false, true])(
      '应在请求结束后移除取消桥接监听（请求失败：%s）',
      async failed => {
        const reason = new Error('later cancellation')
        const controller = new AbortController()
        let transportSignal: AbortSignal | undefined
        mockUrllib.request.mockImplementationOnce(async (_url, options) => {
          transportSignal = options?.signal as AbortSignal | undefined
          if (failed) {
            throw new Error('request failed')
          }
          return {
            res: Readable.from([JSON.stringify(mockPackageData)]),
            headers: {},
            status: 200,
          } as unknown as Awaited<ReturnType<typeof urllib.request>>
        })
        const request = getNpmPackage('test-package', {
          signal: controller.signal,
          timeout: 0,
        })
        if (failed) {
          await expect(request).rejects.toMatchObject({
            code: 'ERR_NPM_REGISTRY_REQUEST',
          })
        } else {
          await expect(request).resolves.toEqual(mockPackageData)
        }
        controller.abort(reason)
        expect(transportSignal?.aborted).toBe(false)
        expect(reason).not.toHaveProperty('opaque')
      },
    )

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

    it('应在请求下一跳前拒绝 HTTPS 降级', async () => {
      const body = Readable.from(['redirect'])
      mockUrllib.request.mockResolvedValueOnce({
        res: body,
        headers: { location: 'http://registry.example.com/package' },
        status: 302,
      } as unknown as Awaited<ReturnType<typeof urllib.request>>)

      await expect(
        getNpmPackage('test-package', {
          registry: 'https://registry.example.com',
        }),
      ).rejects.toMatchObject({
        code: 'ERR_NPM_REGISTRY_REQUEST',
        details: { reason: 'REDIRECT' },
      })
      expect(mockUrllib.request).toHaveBeenCalledOnce()
      expect(body.destroyed).toBe(true)
    })

    it.each([
      'ftp://registry.example.com',
      'https://user:password@registry.example.com',
    ])('应在读取凭据前拒绝不安全 registry %s', async registry => {
      await expect(
        getNpmPackage('test-package', { registry }),
      ).rejects.toMatchObject({
        code: 'ERR_NPM_REGISTRY_REQUEST',
        details: { reason: 'PROTOCOL' },
      })
      expect(mockGetNpmRequestConfig).not.toHaveBeenCalled()
      expect(mockUrllib.request).not.toHaveBeenCalled()
    })

    it.each([
      { timeout: -1 },
      { timeout: Number.NaN },
      { timeout: 0.5 },
      { timeout: 2_147_483_648 },
      { maxBytes: 0 },
      { maxBytes: -1 },
      { maxBytes: Number.POSITIVE_INFINITY },
      { maxBytes: 1.5 },
    ])('应在访问 registry 前拒绝无效资源限制 %j', async options => {
      await expect(
        getNpmPackage('test-package', options),
      ).rejects.toBeInstanceOf(RangeError)
      expect(mockUrllib.request).not.toHaveBeenCalled()
    })

    it('应保留请求与代理关闭的独立错误', async () => {
      const cause = new Error('request failed')
      const cleanupError = new Error('proxy close failed')
      const close = vi.fn().mockRejectedValue(cleanupError)
      vi.mocked(ProxyAgent).mockImplementation(function MockProxyAgent() {
        return { close }
      } as unknown as typeof ProxyAgent)
      mockGetNpmRequestConfig.mockResolvedValue({
        proxy: 'http://proxy.example.com:8080',
      })
      mockUrllib.request.mockRejectedValueOnce(cause)

      await expect(getNpmPackage('test-package')).rejects.toMatchObject({
        errors: [{ code: 'ERR_NPM_REGISTRY_REQUEST', cause }, cleanupError],
      })
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
