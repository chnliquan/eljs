import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockedFunction,
} from 'vitest'
/**
 * @file packages/release utils/version 模块单元测试
 * @description 测试 version.ts 版本处理功能
 */

import { getGitCommitSha, run } from '@eljs/utils'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'

import {
  getCanaryVersion,
  getMaxVersion,
  getReferenceVersion,
  getReleaseVersion,
  getStableVersion,
  isAlphaVersion,
  isBetaVersion,
  isCanaryVersion,
  isPrerelease,
  isRcVersion,
  isVersionExist,
  isVersionValid,
  parseVersion,
} from '../../src/utils/version'

// 模拟依赖
vi.mock('@eljs/utils', () => ({
  getGitCommitSha: vi.fn(),
  run: vi.fn(),
}))
vi.mock('@eljs/utils/cp', async () => import('@eljs/utils'))
vi.mock('@eljs/utils/git', async () => import('@eljs/utils'))

describe('版本处理工具函数测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('预发布版本检测函数', () => {
    describe('isPrerelease', () => {
      it('应该正确识别 alpha 预发布版本', () => {
        expect(isPrerelease('1.0.0-alpha.1')).toBe(true)
        expect(isPrerelease('2.1.0-alpha.2')).toBe(true)
      })

      it('应该正确识别 beta 预发布版本', () => {
        expect(isPrerelease('1.0.0-beta.1')).toBe(true)
        expect(isPrerelease('2.1.0-beta.2')).toBe(true)
      })

      it('应该正确识别 rc 预发布版本', () => {
        expect(isPrerelease('1.0.0-rc.1')).toBe(true)
        expect(isPrerelease('2.1.0-rc.2')).toBe(true)
      })

      it('应该正确识别 canary 预发布版本', () => {
        expect(isPrerelease('1.0.0-canary.1')).toBe(true)
        expect(isPrerelease('2.1.0-canary.20231113-abc123')).toBe(true)
      })

      it('应该正确识别正式版本', () => {
        expect(isPrerelease('1.0.0')).toBe(false)
        expect(isPrerelease('2.1.3')).toBe(false)
      })

      it('应该识别自定义预发布 ID', () => {
        expect(isPrerelease('1.0.0-preview.1')).toBe(true)
        expect(isPrerelease('1.0.0-next.2')).toBe(true)
      })
    })

    describe('isAlphaVersion', () => {
      it('应该正确识别 alpha 版本', () => {
        expect(isAlphaVersion('1.0.0-alpha.1')).toBe(true)
        expect(isAlphaVersion('1.0.0-alpha.2')).toBe(true)
      })

      it('应该正确排除非 alpha 版本', () => {
        expect(isAlphaVersion('1.0.0-beta.1')).toBe(false)
        expect(isAlphaVersion('1.0.0-rc.1')).toBe(false)
        expect(isAlphaVersion('1.0.0')).toBe(false)
      })
    })

    describe('isBetaVersion', () => {
      it('应该正确识别 beta 版本', () => {
        expect(isBetaVersion('1.0.0-beta.1')).toBe(true)
        expect(isBetaVersion('2.1.0-beta.3')).toBe(true)
      })

      it('应该正确排除非 beta 版本', () => {
        expect(isBetaVersion('1.0.0-alpha.1')).toBe(false)
        expect(isBetaVersion('1.0.0-rc.1')).toBe(false)
        expect(isBetaVersion('1.0.0')).toBe(false)
      })
    })

    describe('isRcVersion', () => {
      it('应该正确识别 rc 版本', () => {
        expect(isRcVersion('1.0.0-rc.1')).toBe(true)
        expect(isRcVersion('2.1.0-rc.2')).toBe(true)
      })

      it('应该正确排除非 rc 版本', () => {
        expect(isRcVersion('1.0.0-alpha.1')).toBe(false)
        expect(isRcVersion('1.0.0-beta.1')).toBe(false)
        expect(isRcVersion('1.0.0')).toBe(false)
      })
    })

    describe('isCanaryVersion', () => {
      it('应该正确识别 canary 版本', () => {
        expect(isCanaryVersion('1.0.0-canary.1')).toBe(true)
        expect(isCanaryVersion('2.1.0-canary.20231113-abc123')).toBe(true)
      })

      it('应该正确排除非 canary 版本', () => {
        expect(isCanaryVersion('1.0.0-alpha.1')).toBe(false)
        expect(isCanaryVersion('1.0.0-beta.1')).toBe(false)
        expect(isCanaryVersion('1.0.0')).toBe(false)
      })
    })
  })

  describe('版本验证函数', () => {
    describe('isVersionValid', () => {
      it('应该验证有效的语义化版本', () => {
        expect(isVersionValid('1.0.0')).toBe(true)
        expect(isVersionValid('1.2.3')).toBe(true)
        expect(isVersionValid('1.0.0-alpha.1')).toBe(true)
      })

      it('应该拒绝无效的语义化版本', () => {
        expect(isVersionValid('1.0')).toBe(false)
        expect(isVersionValid('invalid')).toBe(false)
        expect(isVersionValid('')).toBe(false)
      })

      it('当 releaseType 为 true 时应该接受发布类型', () => {
        expect(isVersionValid('major', true)).toBe(true)
        expect(isVersionValid('minor', true)).toBe(true)
        expect(isVersionValid('patch', true)).toBe(true)
        expect(isVersionValid('premajor', true)).toBe(true)
        expect(isVersionValid('preminor', true)).toBe(true)
        expect(isVersionValid('prepatch', true)).toBe(true)
        expect(isVersionValid('prerelease', true)).toBe(true)
      })

      it('当 releaseType 为 false 时应该拒绝发布类型', () => {
        expect(isVersionValid('major', false)).toBe(false)
        expect(isVersionValid('minor', false)).toBe(false)
        expect(isVersionValid('invalid', false)).toBe(false)
      })
    })
  })

  describe('版本解析函数', () => {
    describe('parseVersion', () => {
      it('应该正确解析正式版本', () => {
        const result = parseVersion('1.2.3')
        expect(result).toEqual({
          version: '1.2.3',
          isPrerelease: false,
          prereleaseId: null,
        })
      })

      it('应该正确解析预发布版本', () => {
        const result = parseVersion('1.2.3-alpha.1')
        expect(result).toEqual({
          version: '1.2.3-alpha.1',
          isPrerelease: true,
          prereleaseId: 'alpha',
        })
      })

      it('应该正确解析带数字预发布标识的版本', () => {
        const result = parseVersion('1.2.3-1')
        expect(result).toEqual({
          version: '1.2.3-1',
          isPrerelease: true,
          prereleaseId: null,
        })
      })

      it('应该对无效版本抛出错误', () => {
        expect(() => parseVersion('invalid')).toThrow(
          'Invalid semantic version `invalid`.',
        )
        expect(() => parseVersion('')).toThrow('Invalid semantic version ``.')
      })

      it('应该正确处理复杂预发布版本', () => {
        const result = parseVersion('2.0.0-beta.2')
        expect(result).toEqual({
          version: '2.0.0-beta.2',
          isPrerelease: true,
          prereleaseId: 'beta',
        })
      })

      it('应该规范化带 v 前缀的版本', () => {
        expect(parseVersion('v1.2.3')).toEqual({
          version: '1.2.3',
          isPrerelease: false,
          prereleaseId: null,
        })
      })
    })
  })

  describe('版本存在性检查', () => {
    describe('isVersionExist', () => {
      it('应该在版本存在时返回 true', async () => {
        const mockRun = run as MockedFunction<typeof run>
        mockRun.mockResolvedValue({
          stdout: '{"name":"it-package","version":"1.0.0"}',
        } as Awaited<ReturnType<typeof run>>)

        const result = await isVersionExist('it-package', '1.0.0')
        expect(result).toBe(true)
        expect(mockRun).toHaveBeenCalledWith(
          'npm',
          [
            'view',
            'it-package@1.0.0',
            'name',
            'version',
            '--json=true',
            '--usage=false',
          ],
          { verbose: false, stdout: 'pipe', stderr: 'pipe' },
        )
      })

      it('应该在版本不存在时返回 false', async () => {
        const mockRun = run as MockedFunction<typeof run>
        mockRun.mockResolvedValue({ stdout: '' } as Awaited<
          ReturnType<typeof run>
        >)

        const result = await isVersionExist('it-package', '1.0.0')
        expect(result).toBe(false)
      })

      it('应该在版本查询返回 404 时返回 false', async () => {
        const mockRun = run as MockedFunction<typeof run>
        mockRun.mockRejectedValue(
          new Error('npm ERR! code E404 - No match found for version 1.0.0'),
        )

        const result = await isVersionExist('it-package', '1.0.0')
        expect(result).toBe(false)
      })

      it.each([
        'Publish a package\nUsage:\nnpm view <package-spec>',
        '10.9.8',
        '{"name":"other-package","version":"1.0.0"}',
        '{"name":"it-package","version":"1.0.1"}',
        '{"name":"it-package"}',
        '{"version":"1.0.0"}',
        '[{"name":"it-package","version":"1.0.0"}]',
        '"it-package@1.0.0"',
        'null',
        '{}',
        '{"name":"it-package","version":100}',
      ])('不能将异常输出 %s 用作 retry skip 依据', async stdout => {
        vi.mocked(run).mockResolvedValue({ stdout } as Awaited<
          ReturnType<typeof run>
        >)
        await expect(
          isVersionExist('it-package', '1.0.0'),
        ).rejects.toMatchObject({
          name: 'ReleaseCommandError',
          message: 'Release operation failed',
        })
      })

      it('结构化的作用域包和预发布版本必须精确匹配', async () => {
        vi.mocked(run).mockResolvedValue({
          stdout: '\n{"name":"@it/package","version":"1.0.0-beta.1"}\n',
        } as Awaited<ReturnType<typeof run>>)
        await expect(
          isVersionExist('@it/package', '1.0.0-beta.1'),
        ).resolves.toBe(true)
      })

      it('解析错误不回显响应中的凭据，响应文本不触发 404 回退', async () => {
        const secret = 'unique-response-secret'
        vi.mocked(run).mockResolvedValue({
          stdout: `E404 https://user:${secret}@registry.invalid`,
        } as Awaited<ReturnType<typeof run>>)
        const error = await isVersionExist('it-package', '1.0.0').catch(
          value => value,
        )
        expect(error.name).toBe('ReleaseCommandError')
        expect(error.stack).not.toContain(secret)
        expect(error.cause).toBeUndefined()
        expect(JSON.stringify(error)).not.toContain(secret)
      })

      it('应该安全传播网络或鉴权错误', async () => {
        const mockRun = run as MockedFunction<typeof run>
        mockRun.mockRejectedValue(new Error('network timeout'))

        await expect(isVersionExist('it-package', '1.0.0')).rejects.toThrow(
          'Release operation failed',
        )
      })

      it.each(['E401', 'ECONNRESET', 'ETIMEDOUT'])(
        '%s 错误不保留 URL userinfo、输出、堆栈或原始 cause',
        async code => {
          const secret = 'unique-registry-password'
          const registry = `https://user:${secret}@registry.invalid`
          const raw = Object.assign(new Error(`npm view failed: ${registry}`), {
            code,
            exitCode: 1,
            stdout: registry,
            stderr: registry,
            cause: new Error(secret),
          })
          vi.mocked(run).mockRejectedValue(raw)
          const error = await isVersionExist('app', '1.0.0', registry).catch(
            value => value,
          )
          expect(error).not.toBe(raw)
          expect(error).toMatchObject({
            name: 'ReleaseCommandError',
            code,
            exitCode: 1,
          })
          expect(error.cause).toBeUndefined()
          expect(error.stdout).toBeUndefined()
          expect(error.stderr).toBeUndefined()
          expect(error.stack).not.toContain(secret)
          expect(JSON.stringify(error)).not.toContain(secret)
        },
      )

      it('取消状态保留但取消原因不进入安全错误', async () => {
        const controller = new AbortController()
        controller.abort(new Error('secret-cancel-reason'))
        vi.mocked(run).mockRejectedValue(controller.signal.reason)
        await expect(
          isVersionExist(
            'app',
            '1.0.0',
            undefined,
            undefined,
            controller.signal,
          ),
        ).rejects.toMatchObject({ name: 'AbortError', isCanceled: true })
      })

      it('应该使用指定的 registry', async () => {
        const mockRun = run as MockedFunction<typeof run>
        mockRun.mockResolvedValue({
          stdout: '{"name":"it-package","version":"1.0.0"}',
        } as Awaited<ReturnType<typeof run>>)

        await isVersionExist(
          'it-package',
          '1.0.0',
          'https://custom-registry.com',
        )
        expect(mockRun).toHaveBeenCalledWith(
          'npm',
          [
            'view',
            'it-package@1.0.0',
            'name',
            'version',
            '--json=true',
            '--usage=false',
            '--registry',
            'https://custom-registry.com',
          ],
          { verbose: false, stdout: 'pipe', stderr: 'pipe' },
        )
      })

      it('应该在指定工作目录中读取 npm 配置', async () => {
        const mockRun = run as MockedFunction<typeof run>
        mockRun.mockResolvedValue({
          stdout: '{"name":"it-package","version":"1.0.0"}',
        } as Awaited<ReturnType<typeof run>>)

        await isVersionExist(
          'it-package',
          '1.0.0',
          'https://custom-registry.com',
          '/target/project',
        )

        expect(mockRun).toHaveBeenCalledWith(
          'npm',
          [
            'view',
            'it-package@1.0.0',
            'name',
            'version',
            '--json=true',
            '--usage=false',
            '--registry',
            'https://custom-registry.com',
          ],
          {
            cwd: '/target/project',
            verbose: false,
            stdout: 'pipe',
            stderr: 'pipe',
          },
        )
      })

      it('真实 npm 在继承 usage 和非 JSON 配置时仍从本地 registry 核对精确身份', async () => {
        const { run: runCommand } =
          await vi.importActual<typeof import('@eljs/utils/cp')>(
            '@eljs/utils/cp',
          )
        const cwd = await mkdtemp(path.join(tmpdir(), 'release-version-query-'))
        const requests: string[] = []
        const server = createServer((request, response) => {
          requests.push(`${request.method} ${request.url}`)
          response.setHeader('content-type', 'application/json')
          response.end(
            JSON.stringify({
              name: '@it/package',
              'dist-tags': { latest: '1.0.0-beta.1' },
              versions: {
                '1.0.0-beta.1': {
                  name: '@it/package',
                  version: '1.0.0-beta.1',
                },
              },
            }),
          )
        })
        try {
          await writeFile(path.join(cwd, '.npmrc'), 'usage=true\njson=false\n')
          const userConfig = path.join(cwd, 'user.npmrc')
          const globalConfig = path.join(cwd, 'global.npmrc')
          await writeFile(userConfig, '')
          await writeFile(globalConfig, '')
          await new Promise<void>(resolve =>
            server.listen(0, '127.0.0.1', resolve),
          )
          const address = server.address()
          if (!address || typeof address === 'string')
            throw new Error('Missing test server address')
          vi.mocked(run).mockImplementation(((
            _command: string,
            args: string[],
          ) =>
            runCommand('npm', args, {
              cwd,
              timeout: 5000,
              env: {
                ...Object.fromEntries(
                  Object.entries(process.env).filter(
                    ([key]) => !/^npm_config_/i.test(key),
                  ),
                ),
                npm_config_userconfig: userConfig,
                npm_config_globalconfig: globalConfig,
                npm_config_cache: path.join(cwd, 'cache'),
                npm_config_usage: 'true',
                npm_config_json: 'false',
                npm_config_fetch_retries: '0',
                npm_config_update_notifier: 'false',
              },
            })) as unknown as typeof run)
          const registry = `http://127.0.0.1:${address.port}`
          await expect(
            isVersionExist('@it/package', '1.0.0-beta.1', registry, cwd),
          ).resolves.toBe(true)
          await expect(
            isVersionExist('@it/package', '1.0.0-beta.2', registry, cwd),
          ).resolves.toBe(false)
          expect(requests.length).toBeGreaterThan(0)
          expect(
            requests.every(request => /^GET \/@it%2fpackage$/i.test(request)),
            requests.join('\n'),
          ).toBe(true)
        } finally {
          await new Promise<void>((resolve, reject) =>
            server.close(error => (error ? reject(error) : resolve())),
          )
          await rm(cwd, { recursive: true, force: true })
        }
      }, 15_000)
    })
  })

  describe('版本处理工具函数', () => {
    describe('getStableVersion', () => {
      it('应该从预发布版本中提取稳定版本', () => {
        expect(getStableVersion('1.2.3-alpha.1')).toBe('1.2.3')
        expect(getStableVersion('2.0.0-beta.2')).toBe('2.0.0')
        expect(getStableVersion('1.0.0-rc.1')).toBe('1.0.0')
      })

      it('应该返回稳定版本本身', () => {
        expect(getStableVersion('1.2.3')).toBe('1.2.3')
        expect(getStableVersion('2.0.0')).toBe('2.0.0')
      })
    })

    describe('getMaxVersion', () => {
      it('应该返回最大的版本', () => {
        expect(getMaxVersion('1.0.0', '1.1.0', '1.0.1')).toBe('1.1.0')
        expect(getMaxVersion('2.0.0', '1.9.9')).toBe('2.0.0')
      })

      it('应该忽略空版本', () => {
        expect(getMaxVersion('1.0.0', '', '1.1.0')).toBe('1.1.0')
        expect(getMaxVersion('', '1.0.0')).toBe('1.0.0')
      })

      it('应该处理单个版本', () => {
        expect(getMaxVersion('1.0.0')).toBe('1.0.0')
      })
    })

    describe('getReleaseVersion', () => {
      it('应该正确计算 major 版本升级', () => {
        expect(getReleaseVersion('1.2.3', 'major')).toBe('2.0.0')
      })

      it('应该正确计算 minor 版本升级', () => {
        expect(getReleaseVersion('1.2.3', 'minor')).toBe('1.3.0')
      })

      it('应该正确计算 patch 版本升级', () => {
        expect(getReleaseVersion('1.2.3', 'patch')).toBe('1.2.4')
      })

      it('应该正确计算预发布版本升级', () => {
        expect(getReleaseVersion('1.2.3', 'premajor', 'alpha')).toBe(
          '2.0.0-alpha.0',
        )
        expect(getReleaseVersion('1.2.3', 'preminor', 'beta')).toBe(
          '1.3.0-beta.0',
        )
      })

      it('应该使用默认预发布 ID', () => {
        expect(getReleaseVersion('1.2.3', 'premajor')).toBe('2.0.0-beta.0')
      })

      it('无法生成合法版本时应该抛出明确错误', () => {
        expect(() => getReleaseVersion('invalid', 'patch')).toThrow(
          'Unable to increment semantic version `invalid`',
        )
        expect(() =>
          getReleaseVersion('1.2.3', 'prerelease', 'preview tag'),
        ).toThrow('prerelease identifier `preview tag`')
      })
    })
  })

  describe('基准版本计算', () => {
    describe('getReferenceVersion', () => {
      it('应该在没有远程版本时返回本地版本', () => {
        expect(getReferenceVersion('1.0.0', '', 'latest')).toBe('1.0.0')
      })

      it('应该为 latest 标签返回较大的版本', () => {
        expect(getReferenceVersion('1.0.0', '1.1.0', 'latest')).toBe('1.1.0')
        expect(getReferenceVersion('1.1.0', '1.0.0', 'latest')).toBe('1.1.0')
      })

      it('应该为预发布标签正确处理稳定版本', () => {
        expect(
          getReferenceVersion('1.0.0-alpha.1', '1.0.0-alpha.2', 'alpha'),
        ).toBe('1.0.0-alpha.2')
        expect(
          getReferenceVersion('1.1.0-alpha.1', '1.0.0-alpha.2', 'alpha'),
        ).toBe('1.1.0-alpha.1')
      })
    })
  })

  describe('Canary 版本生成', () => {
    describe('getCanaryVersion', () => {
      it('应该生成正确的 canary 版本', async () => {
        const mockGetGitCommitSha = getGitCommitSha as MockedFunction<
          typeof getGitCommitSha
        >
        mockGetGitCommitSha.mockResolvedValue('abc123')

        // 模拟当前日期
        const mockDate = new Date('2023-11-13T10:00:00Z')
        vi.useFakeTimers()
        vi.setSystemTime(mockDate)

        const result = await getCanaryVersion('1.0.0')
        expect(result).toBe('1.0.1-canary.20231113-abc123')

        mockGetGitCommitSha.mockRestore()
        vi.useRealTimers()
        vi.restoreAllMocks()
      })

      it('应该为预发布版本生成 canary 版本', async () => {
        const mockGetGitCommitSha = getGitCommitSha as MockedFunction<
          typeof getGitCommitSha
        >
        mockGetGitCommitSha.mockResolvedValue('def456')

        const mockDate = new Date('2023-12-01T15:30:00Z')
        vi.useFakeTimers()
        vi.setSystemTime(mockDate)

        const result = await getCanaryVersion('1.1.0-beta.1')
        expect(result).toBe('1.1.0-canary.20231201-def456')

        mockGetGitCommitSha.mockRestore()
        vi.useRealTimers()
        vi.restoreAllMocks()
      })

      it('应该使用指定的工作目录', async () => {
        const mockGetGitCommitSha = getGitCommitSha as MockedFunction<
          typeof getGitCommitSha
        >
        mockGetGitCommitSha.mockResolvedValue('xyz789')

        const mockDate = new Date('2023-11-13T10:00:00Z')
        vi.useFakeTimers()
        vi.setSystemTime(mockDate)

        const cwd = '/custom/path'
        await getCanaryVersion('2.0.0', cwd)

        expect(mockGetGitCommitSha).toHaveBeenCalledWith(true, { cwd })

        mockGetGitCommitSha.mockRestore()
        vi.useRealTimers()
        vi.restoreAllMocks()
      })

      it('应该正确处理已经是 canary 版本的情况', async () => {
        const mockGetGitCommitSha = getGitCommitSha as MockedFunction<
          typeof getGitCommitSha
        >
        mockGetGitCommitSha.mockResolvedValue('abc123')

        const mockDate = new Date('2023-11-13T10:00:00Z')
        vi.useFakeTimers()
        vi.setSystemTime(mockDate)

        const result = await getCanaryVersion('1.0.0-canary.20231112-old123')
        expect(result).toBe('1.0.0-canary.20231113-abc123')

        mockGetGitCommitSha.mockRestore()
        vi.useRealTimers()
        vi.restoreAllMocks()
      })
    })
  })
})
