/**
 * @file packages/release utils/version 模块单元测试
 * @description 测试 version.ts 版本处理功能
 */

import { getGitCommitSha, run } from '@eljs/utils'

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
jest.mock('@eljs/utils', () => ({
  getGitCommitSha: jest.fn(),
  run: jest.fn(),
}))

describe('版本处理工具函数测试', () => {
  beforeEach(() => {
    jest.clearAllMocks()
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
    })
  })

  describe('版本存在性检查', () => {
    describe('isVersionExist', () => {
      it('应该在版本存在时返回 true', async () => {
        const mockRun = run as jest.MockedFunction<typeof run>
        mockRun.mockResolvedValue({ stdout: '@it/package@1.0.0' } as Awaited<
          ReturnType<typeof run>
        >)

        const result = await isVersionExist('it-package', '1.0.0')
        expect(result).toBe(true)
        expect(mockRun).toHaveBeenCalledWith('npm', [
          'view',
          'it-package@1.0.0',
        ])
      })

      it('应该在版本不存在时返回 false', async () => {
        const mockRun = run as jest.MockedFunction<typeof run>
        mockRun.mockResolvedValue({ stdout: '' } as Awaited<
          ReturnType<typeof run>
        >)

        const result = await isVersionExist('it-package', '1.0.0')
        expect(result).toBe(false)
      })

      it('应该在命令执行失败时返回 false', async () => {
        const mockRun = run as jest.MockedFunction<typeof run>
        mockRun.mockRejectedValue(new Error('命令执行失败'))

        const result = await isVersionExist('it-package', '1.0.0')
        expect(result).toBe(false)
      })

      it('应该使用指定的 registry', async () => {
        const mockRun = run as jest.MockedFunction<typeof run>
        mockRun.mockResolvedValue({ stdout: '@it/package@1.0.0' } as Awaited<
          ReturnType<typeof run>
        >)

        await isVersionExist(
          'it-package',
          '1.0.0',
          'https://custom-registry.com',
        )
        expect(mockRun).toHaveBeenCalledWith('npm', [
          'view',
          'it-package@1.0.0',
          '--registry',
          'https://custom-registry.com',
        ])
      })
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
        const mockGetGitCommitSha = getGitCommitSha as jest.MockedFunction<
          typeof getGitCommitSha
        >
        mockGetGitCommitSha.mockResolvedValue('abc123')

        // 模拟当前日期
        const mockDate = new Date('2023-11-13T10:00:00Z')
        jest.spyOn(global, 'Date').mockImplementation(() => mockDate)

        const result = await getCanaryVersion('1.0.0')
        expect(result).toBe('1.0.1-canary.20231113-abc123')

        mockGetGitCommitSha.mockRestore()
        jest.restoreAllMocks()
      })

      it('应该为预发布版本生成 canary 版本', async () => {
        const mockGetGitCommitSha = getGitCommitSha as jest.MockedFunction<
          typeof getGitCommitSha
        >
        mockGetGitCommitSha.mockResolvedValue('def456')

        const mockDate = new Date('2023-12-01T15:30:00Z')
        jest.spyOn(global, 'Date').mockImplementation(() => mockDate)

        const result = await getCanaryVersion('1.1.0-beta.1')
        expect(result).toBe('1.1.0-canary.20231201-def456')

        mockGetGitCommitSha.mockRestore()
        jest.restoreAllMocks()
      })

      it('应该使用指定的工作目录', async () => {
        const mockGetGitCommitSha = getGitCommitSha as jest.MockedFunction<
          typeof getGitCommitSha
        >
        mockGetGitCommitSha.mockResolvedValue('xyz789')

        const mockDate = new Date('2023-11-13T10:00:00Z')
        jest.spyOn(global, 'Date').mockImplementation(() => mockDate)

        const cwd = '/custom/path'
        await getCanaryVersion('2.0.0', cwd)

        expect(mockGetGitCommitSha).toHaveBeenCalledWith(true, { cwd })

        mockGetGitCommitSha.mockRestore()
        jest.restoreAllMocks()
      })

      it('应该正确处理已经是 canary 版本的情况', async () => {
        const mockGetGitCommitSha = getGitCommitSha as jest.MockedFunction<
          typeof getGitCommitSha
        >
        mockGetGitCommitSha.mockResolvedValue('abc123')

        const mockDate = new Date('2023-11-13T10:00:00Z')
        jest.spyOn(global, 'Date').mockImplementation(() => mockDate)

        const result = await getCanaryVersion('1.0.0-canary.20231112-old123')
        expect(result).toBe('1.0.0-canary.20231113-abc123')

        mockGetGitCommitSha.mockRestore()
        jest.restoreAllMocks()
      })
    })
  })
})
