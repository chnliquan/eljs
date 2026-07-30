import * as importedModule0 from 'semver'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
  type MockedFunction,
} from 'vitest'
/**
 * @file packages/release internal/plugins/version 模块单元测试
 * @description 测试 version.ts 版本管理插件功能
 */

import { confirm, logger, prompts } from '@eljs/utils'

import versionPlugin from '../../../src/internal/plugins/version'
import type { PrereleaseId } from '../../../src/types'
import {
  getCanaryVersion,
  getMaxVersion,
  getReleaseVersion,
  getRemoteDistTag,
  isCanaryVersion,
  isVersionExist,
  isVersionValid,
  updatePackageLock,
  updatePackageVersion,
} from '../../../src/utils'

const requiredModule0 = vi.mocked(importedModule0, { deep: true })

// 模拟所有依赖
vi.mock('@eljs/utils', () => ({
  chalk: {
    cyan: vi.fn((text: string) => `[cyan]${text}[/cyan]`),
    green: vi.fn((text: string) => `[green]${text}[/green]`),
    yellow: vi.fn((text: string) => `[yellow]${text}[/yellow]`),
    grey: vi.fn((text: string) => `[grey]${text}[/grey]`),
  },
  confirm: vi.fn(),
  createDebugger: vi.fn(() => vi.fn()),
  logger: {
    info: vi.fn(),
  },
  pascalCase: vi.fn(),
  prompts: vi.fn(),
}))

vi.mock('semver', () => {
  const releaseTypes = ['major', 'minor', 'patch']

  return {
    default: {
      valid: vi.fn(),
      RELEASE_TYPES: releaseTypes,
    },
    RELEASE_TYPES: releaseTypes,
    valid: vi.fn(),
  }
})

vi.mock('../../../src/constants', () => ({
  prereleaseTypes: ['prerelease', 'prepatch', 'preminor', 'premajor'],
}))

vi.mock('../../../src/utils', () => ({
  AppError: class AppError extends Error {
    public constructor(message: string) {
      super(message)
      this.name = 'AppError'
    }
  },
  getCanaryVersion: vi.fn(),
  getMaxVersion: vi.fn(),
  getReleaseVersion: vi.fn(),
  getRemoteDistTag: vi.fn(),
  isCanaryVersion: vi.fn(),
  isVersionExist: vi.fn(),
  isVersionValid: vi.fn(),
  onCancel: vi.fn(),
  updatePackageLock: vi.fn(),
  updatePackageVersion: vi.fn(),
}))

describe('版本插件测试', () => {
  // 为了测试的简洁性，在这个文件中允许使用 any 类型
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockApi: any

  beforeEach(() => {
    mockApi = {
      onCheck: vi.fn(),
      getIncrementVersion: vi.fn(),
      onBeforeBumpVersion: vi.fn(),
      onAfterBumpVersion: vi.fn(),
      onBumpVersion: vi.fn(),
      step: vi.fn(),
      config: {
        npm: {
          confirm: true,
          canary: false,
          prerelease: false,
          requireOwner: false,
          prereleaseId: undefined,
          publishArgs: [],
        },
      },
      appData: {
        cliVersion: '1.0.0',
        registry: 'https://registry.npmjs.org',
        branch: 'main',
        latestTag: null,
        validPkgNames: ['test-package'],
        pkgs: [{ name: 'test-package', version: '1.0.0' }],
        pkgJsonPaths: ['/test/package.json'],
        packageManager: 'npm',
        pkgNames: ['test-package'],
        validPkgRootPaths: ['/test'],
        projectPkg: { name: 'test-project', version: '1.0.0' },
        projectPkgJsonPath: '/test/project/package.json',
      },
      cwd: '/test/project',
    }

    vi.clearAllMocks()

    // 设置默认模拟返回值
    ;(isVersionValid as MockedFunction<typeof isVersionValid>).mockReturnValue(
      true,
    )
    ;(
      getRemoteDistTag as MockedFunction<typeof getRemoteDistTag>
    ).mockResolvedValue({
      latest: '1.0.0',
      alpha: '',
      beta: '',
      rc: '',
    })
    ;(getMaxVersion as MockedFunction<typeof getMaxVersion>).mockReturnValue(
      '1.0.0',
    )
    ;(
      getReleaseVersion as MockedFunction<typeof getReleaseVersion>
    ).mockReturnValue('1.1.0')
    ;(
      getCanaryVersion as MockedFunction<typeof getCanaryVersion>
    ).mockResolvedValue('1.1.0-canary.20231113-abc123')
    ;(
      isVersionExist as MockedFunction<typeof isVersionExist>
    ).mockResolvedValue(false)
    ;(
      isCanaryVersion as MockedFunction<typeof isCanaryVersion>
    ).mockReturnValue(false)
    ;(confirm as MockedFunction<typeof confirm>).mockResolvedValue(true)
    ;(prompts as MockedFunction<typeof prompts>).mockResolvedValue({
      value: '1.1.0',
    })
    ;(
      updatePackageVersion as MockedFunction<typeof updatePackageVersion>
    ).mockResolvedValue(undefined)
    ;(
      updatePackageLock as MockedFunction<typeof updatePackageLock>
    ).mockResolvedValue(undefined)

    // 模拟 semver.valid

    const semverModule = requiredModule0 as unknown as {
      valid: Mock
      default: { valid: Mock }
    }
    semverModule.valid.mockReturnValue('1.1.0')
    semverModule.default.valid = semverModule.valid
  })

  describe('插件注册', () => {
    it('应该注册所有必需的钩子方法', () => {
      versionPlugin(mockApi)

      expect(mockApi.onCheck).toHaveBeenCalledWith(expect.any(Function))
      expect(mockApi.getIncrementVersion).toHaveBeenCalledWith(
        expect.any(Function),
        { stage: 10 },
      )
      expect(mockApi.onBeforeBumpVersion).toHaveBeenCalledWith(
        expect.any(Function),
      )
      expect(mockApi.onBumpVersion).toHaveBeenCalledWith(expect.any(Function))
      expect(mockApi.onAfterBumpVersion).toHaveBeenCalledWith(
        expect.any(Function),
      )
    })
  })

  describe('onCheck 钩子测试', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let onCheckHandler: any

    beforeEach(() => {
      versionPlugin(mockApi)

      onCheckHandler = mockApi.onCheck.mock.calls[0][0]
    })

    it('应该验证有效的版本', async () => {
      ;(
        isVersionValid as MockedFunction<typeof isVersionValid>
      ).mockReturnValue(true)

      await onCheckHandler({ releaseTypeOrVersion: '1.2.0' })

      expect(isVersionValid).toHaveBeenCalledWith('1.2.0', true)
    })

    it('应该对无效版本抛出错误', async () => {
      ;(
        isVersionValid as MockedFunction<typeof isVersionValid>
      ).mockReturnValue(false)

      await expect(
        onCheckHandler({ releaseTypeOrVersion: 'invalid' }),
      ).rejects.toThrow('Invalid semantic version [cyan]invalid[/cyan].')
    })

    it('应该允许空的版本参数', async () => {
      await expect(
        onCheckHandler({ releaseTypeOrVersion: undefined }),
      ).resolves.toBeUndefined()

      expect(isVersionValid).not.toHaveBeenCalled()
    })

    it('应该验证发布类型', async () => {
      ;(
        isVersionValid as MockedFunction<typeof isVersionValid>
      ).mockReturnValue(true)

      await onCheckHandler({ releaseTypeOrVersion: 'major' })

      expect(isVersionValid).toHaveBeenCalledWith('major', true)
    })
  })

  describe('getIncrementVersion 钩子测试', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let getIncrementVersionHandler: any

    beforeEach(() => {
      versionPlugin(mockApi)

      getIncrementVersionHandler = mockApi.getIncrementVersion.mock.calls[0][0]
    })

    it('应该获取增量版本', async () => {
      mockApi.config.npm.confirm = false

      const result = await getIncrementVersionHandler({
        releaseTypeOrVersion: 'minor',
      })

      expect(result).toBe('1.1.0')
      expect(mockApi.step).toHaveBeenCalledWith('Incrementing version ...')
      expect(getRemoteDistTag).toHaveBeenCalledWith(['test-package'], {
        cwd: '/test/project',
        registry: 'https://registry.npmjs.org',
      })
      expect(getReleaseVersion).toHaveBeenCalled()
    })

    it('应该处理 canary 版本', async () => {
      mockApi.config.npm.canary = true
      mockApi.config.npm.confirm = false
      ;(
        getCanaryVersion as MockedFunction<typeof getCanaryVersion>
      ).mockResolvedValue('1.1.0-canary.20231113-abc123')

      // 当没有提供 releaseTypeOrVersion 且配置为 canary 模式时，会调用 getCanaryVersion

      const result = await getIncrementVersionHandler({
        releaseTypeOrVersion: undefined,
      })

      expect(result).toBe('1.1.0-canary.20231113-abc123')
      expect(getCanaryVersion).toHaveBeenCalled()
    })

    it('应该处理预发布版本', async () => {
      mockApi.config.npm.prerelease = true
      mockApi.config.npm.prereleaseId = 'beta'
      mockApi.config.npm.confirm = false

      await getIncrementVersionHandler({ releaseTypeOrVersion: 'minor' })

      // 当提供了 releaseTypeOrVersion 时，直接使用该类型，不会自动转换为 preminor
      expect(getReleaseVersion).toHaveBeenCalledWith(
        expect.any(String),
        'minor',
        'beta',
      )
    })

    it('应该在确认模式下请求用户确认', async () => {
      mockApi.config.npm.confirm = true
      ;(confirm as MockedFunction<typeof confirm>).mockResolvedValue(true)

      const result = await getIncrementVersionHandler({
        releaseTypeOrVersion: 'patch',
      })

      expect(confirm).toHaveBeenCalledWith(
        expect.stringContaining('[cyan]1.1.0[/cyan]'),
      )
      expect(result).toBe('1.1.0')
    })

    it('当用户拒绝确认时应该递归调用', async () => {
      mockApi.config.npm.confirm = true
      ;(confirm as MockedFunction<typeof confirm>)
        .mockResolvedValueOnce(false) // 第一次拒绝
        .mockResolvedValueOnce(true) // 第二次确认
      ;(prompts as MockedFunction<typeof prompts>).mockResolvedValue({
        value: '1.0.1',
      })

      await getIncrementVersionHandler({
        releaseTypeOrVersion: 'patch',
      })

      expect(confirm).toHaveBeenCalledTimes(2)
    })

    it('应该处理版本已存在的情况', async () => {
      // 版本已存在的检查是在 checkVersion 函数中，该函数在 onBeforeBumpVersion 钩子中调用
      mockApi.config.npm.confirm = false

      // 先测试在 onBeforeBumpVersion 中的版本检查

      versionPlugin(mockApi)

      const onBeforeBumpVersionHandler =
        mockApi.onBeforeBumpVersion.mock.calls[0][0]
      ;(
        isVersionExist as MockedFunction<typeof isVersionExist>
      ).mockResolvedValue(true)

      const versionInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
      }

      await expect(onBeforeBumpVersionHandler(versionInfo)).rejects.toThrow(
        'Package [cyan]test-package@1.1.0[/cyan] has been published already.',
      )
    })

    it('应该处理用户选择版本类型', async () => {
      mockApi.config.npm.confirm = false
      ;(prompts as MockedFunction<typeof prompts>).mockResolvedValue({
        value: '1.0.1',
      })

      const result = await getIncrementVersionHandler({
        releaseTypeOrVersion: undefined,
      })

      expect(prompts).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'select',
            name: 'value',
          }),
        ]),
        expect.any(Object),
      )
      expect(result).toBe('1.0.1')
    })

    it('应该处理金丝雀选择', async () => {
      mockApi.config.npm.confirm = false
      ;(prompts as MockedFunction<typeof prompts>).mockResolvedValue({
        value: 'canary',
      })
      ;(
        getCanaryVersion as MockedFunction<typeof getCanaryVersion>
      ).mockResolvedValue('1.1.0-canary.123')

      const result = await getIncrementVersionHandler({
        releaseTypeOrVersion: undefined,
      })

      expect(getCanaryVersion).toHaveBeenCalled()
      expect(result).toBe('1.1.0-canary.123')
    })

    it('应该处理自定义版本输入', async () => {
      mockApi.config.npm.confirm = false
      ;(prompts as MockedFunction<typeof prompts>)
        .mockResolvedValueOnce({ value: 'custom' }) // 第一次选择 custom
        .mockResolvedValueOnce({ value: '2.0.0' }) // 第二次输入自定义版本

      const result = await getIncrementVersionHandler({
        releaseTypeOrVersion: undefined,
      })

      expect(prompts).toHaveBeenCalledTimes(2)
      expect(result).toBe('2.0.0')
    })

    it('应该处理预发布类型选择', async () => {
      mockApi.config.npm.confirm = false
      ;(prompts as MockedFunction<typeof prompts>)
        .mockResolvedValueOnce({ value: 'alpha' }) // 第一次选择 alpha
        .mockResolvedValueOnce({ value: '1.1.0-alpha.1' }) // 第二次选择具体的预发布版本

      const result = await getIncrementVersionHandler({
        releaseTypeOrVersion: undefined,
      })

      expect(prompts).toHaveBeenCalledTimes(2)
      expect(result).toBe('1.1.0-alpha.1')
    })

    it('应该处理预配置的预发布ID', async () => {
      mockApi.config.npm.prereleaseId = 'beta'
      mockApi.config.npm.confirm = false
      ;(prompts as MockedFunction<typeof prompts>).mockResolvedValue({
        value: '1.1.0-beta.1',
      })

      const result = await getIncrementVersionHandler({
        releaseTypeOrVersion: undefined,
      })

      expect(prompts).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'select',
          name: 'value',
          message: 'Please select the beta version to bump:',
        }),
        expect.any(Object),
      )
      expect(result).toBe('1.1.0-beta.1')
    })

    it('应该处理具体版本字符串', async () => {
      mockApi.config.npm.confirm = false

      const result = await getIncrementVersionHandler({
        releaseTypeOrVersion: '2.0.0',
      })

      // 对于具体版本字符串（不是发布类型），应该直接返回
      expect(result).toBe('2.0.0')
    })
  })

  describe('onBumpVersion 钩子测试', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let onBumpVersionHandler: any

    beforeEach(() => {
      versionPlugin(mockApi)

      onBumpVersionHandler = mockApi.onBumpVersion.mock.calls[0][0]
    })

    it('应该更新包版本', async () => {
      const versionInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
      }

      await onBumpVersionHandler(versionInfo)

      expect(updatePackageVersion).toHaveBeenCalledWith(
        '/test/package.json',
        { name: 'test-package', version: '1.0.0' },
        '1.1.0',
        ['test-package'],
      )
    })

    it('应该更新项目根目录 package.json', async () => {
      mockApi.appData.projectPkgJsonPath = '/test/project/package.json'
      mockApi.appData.pkgJsonPaths = ['/test/packages/pkg1/package.json']

      const versionInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
      }

      await onBumpVersionHandler(versionInfo)

      expect(updatePackageVersion).toHaveBeenCalledWith(
        '/test/packages/pkg1/package.json',
        { name: 'test-package', version: '1.0.0' },
        '1.1.0',
        ['test-package'],
      )

      expect(updatePackageVersion).toHaveBeenCalledWith(
        '/test/project/package.json',
        { name: 'test-project', version: '1.0.0' },
        '1.1.0',
      )
    })

    it('不应该重复更新相同的 package.json 文件', async () => {
      mockApi.appData.projectPkgJsonPath = '/test/package.json'
      mockApi.appData.pkgJsonPaths = ['/test/package.json']

      const versionInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
      }

      await onBumpVersionHandler(versionInfo)

      expect(updatePackageVersion).toHaveBeenCalledTimes(1)
    })

    it('应该处理多个包的版本更新', async () => {
      mockApi.appData.pkgs = [
        { name: 'pkg1', version: '1.0.0' },
        { name: 'pkg2', version: '1.0.0' },
      ]
      mockApi.appData.pkgJsonPaths = [
        '/test/pkg1/package.json',
        '/test/pkg2/package.json',
      ]
      mockApi.appData.pkgNames = ['pkg1', 'pkg2']

      const versionInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
      }

      await onBumpVersionHandler(versionInfo)

      expect(updatePackageVersion).toHaveBeenCalledTimes(3)
    })

    it('应该处理版本更新失败', async () => {
      ;(
        updatePackageVersion as MockedFunction<typeof updatePackageVersion>
      ).mockRejectedValue(new Error('版本更新失败'))

      const versionInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
      }

      await expect(onBumpVersionHandler(versionInfo)).rejects.toThrow(
        '版本更新失败',
      )
    })
  })

  describe('onBeforeBumpVersion 钩子测试', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let onBeforeBumpVersionHandler: any

    beforeEach(() => {
      versionPlugin(mockApi)

      onBeforeBumpVersionHandler = mockApi.onBeforeBumpVersion.mock.calls[0][0]
    })

    it('应该检查版本是否已存在', async () => {
      const versionInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
      }

      await onBeforeBumpVersionHandler(versionInfo)

      expect(isVersionExist).toHaveBeenCalledWith(
        'test-package',
        '1.1.0',
        'https://registry.npmjs.org',
      )
    })

    it('当预发布ID不匹配时应该抛出错误', async () => {
      mockApi.config.npm.prereleaseId = 'alpha'

      const versionInfo = {
        version: '1.1.0-beta.1',
        isPrerelease: true,
        prereleaseId: 'beta' as PrereleaseId,
      }

      await expect(onBeforeBumpVersionHandler(versionInfo)).rejects.toThrow(
        'Expected a alpha tag, but got',
      )
    })

    it('当期望预发布但得到正式版本时应该抛出错误', async () => {
      mockApi.config.npm.prerelease = true

      const versionInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
      }

      await expect(onBeforeBumpVersionHandler(versionInfo)).rejects.toThrow(
        'Expected a prerelease type, but got',
      )
    })

    it('当期望正式版本但得到预发布时应该抛出错误', async () => {
      mockApi.config.npm.prerelease = false

      const versionInfo = {
        version: '1.1.0-beta.1',
        isPrerelease: true,
        prereleaseId: 'beta' as PrereleaseId,
      }

      await expect(onBeforeBumpVersionHandler(versionInfo)).rejects.toThrow(
        'Expected a release type, but got',
      )
    })

    it('当版本已存在时应该抛出错误', async () => {
      ;(
        isVersionExist as MockedFunction<typeof isVersionExist>
      ).mockResolvedValue(true)

      const versionInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
      }

      await expect(onBeforeBumpVersionHandler(versionInfo)).rejects.toThrow(
        'Package [cyan]test-package@1.1.0[/cyan] has been published already.',
      )
    })

    it('当版本无效时应该抛出错误', async () => {
      // 模拟 semver.valid 返回 null (无效版本)

      const semverModule = requiredModule0 as unknown as {
        valid: Mock
        default: { valid: Mock }
      }
      semverModule.valid.mockReturnValue(null)

      const versionInfo = {
        version: 'invalid-version',
        isPrerelease: false,
        prereleaseId: null,
      }

      await expect(onBeforeBumpVersionHandler(versionInfo)).rejects.toThrow(
        'Invalid semantic version',
      )
    })
  })

  describe('onAfterBumpVersion 钩子测试', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let onAfterBumpVersionHandler: any

    beforeEach(() => {
      versionPlugin(mockApi)

      onAfterBumpVersionHandler = mockApi.onAfterBumpVersion.mock.calls[0][0]
    })

    it('应该更新包锁文件', async () => {
      const versionInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
      }

      await onAfterBumpVersionHandler(versionInfo)

      expect(mockApi.step).toHaveBeenCalledWith('Updating Lockfile ...')
      expect(updatePackageLock).toHaveBeenCalledWith('npm', {
        cwd: '/test/project',
        verbose: true,
      })
    })

    it('应该使用正确的包管理器', async () => {
      mockApi.appData.packageManager = 'pnpm'
      const versionInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
      }

      await onAfterBumpVersionHandler(versionInfo)

      expect(updatePackageLock).toHaveBeenCalledWith('pnpm', {
        cwd: '/test/project',
        verbose: true,
      })
    })

    it('应该跳过金丝雀版本的锁文件更新', async () => {
      ;(
        isCanaryVersion as MockedFunction<typeof isCanaryVersion>
      ).mockReturnValue(true)

      const versionInfo = {
        version: '1.1.0-canary.123',
        isPrerelease: true,
        prereleaseId: null,
      }

      await onAfterBumpVersionHandler(versionInfo)

      expect(mockApi.step).not.toHaveBeenCalled()
      expect(updatePackageLock).not.toHaveBeenCalled()
    })

    it('应该处理锁文件更新失败', async () => {
      ;(
        updatePackageLock as MockedFunction<typeof updatePackageLock>
      ).mockRejectedValue(new Error('锁文件更新失败'))

      const versionInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
      }

      await expect(onAfterBumpVersionHandler(versionInfo)).rejects.toThrow(
        '锁文件更新失败',
      )
    })
  })

  describe('用户交互测试', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let getIncrementVersionHandler: any

    beforeEach(() => {
      versionPlugin(mockApi)

      getIncrementVersionHandler = mockApi.getIncrementVersion.mock.calls[0][0]
    })

    it('应该在没有指定版本时提示用户选择', async () => {
      mockApi.config.npm.confirm = false
      ;(prompts as MockedFunction<typeof prompts>).mockResolvedValue({
        value: '1.0.1',
      })
      ;(
        getReleaseVersion as MockedFunction<typeof getReleaseVersion>
      ).mockReturnValue('1.0.1')

      const result = await getIncrementVersionHandler({
        releaseTypeOrVersion: undefined,
      })

      expect(prompts).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'select',
            name: 'value',
            message: expect.any(String),
            choices: expect.any(Array),
          }),
        ]),
        expect.any(Object),
      )
      expect(result).toBe('1.0.1')
    })

    it('应该在确认模式下请求用户确认版本', async () => {
      mockApi.config.npm.confirm = true
      ;(
        getReleaseVersion as MockedFunction<typeof getReleaseVersion>
      ).mockReturnValue('1.1.0')
      ;(confirm as MockedFunction<typeof confirm>).mockResolvedValue(true)

      const result = await getIncrementVersionHandler({
        releaseTypeOrVersion: 'minor',
      })

      expect(confirm).toHaveBeenCalledWith(
        expect.stringContaining('[cyan]1.1.0[/cyan]'),
      )
      expect(result).toBe('1.1.0')
    })

    it('当禁用确认时应该直接返回版本', async () => {
      mockApi.config.npm.confirm = false
      ;(
        getReleaseVersion as MockedFunction<typeof getReleaseVersion>
      ).mockReturnValue('1.1.0')

      const result = await getIncrementVersionHandler({
        releaseTypeOrVersion: 'minor',
      })

      expect(confirm).not.toHaveBeenCalled()
      expect(result).toBe('1.1.0')
    })
  })

  describe('版本类型处理测试', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let getIncrementVersionHandler: any

    beforeEach(() => {
      versionPlugin(mockApi)

      getIncrementVersionHandler = mockApi.getIncrementVersion.mock.calls[0][0]
    })

    it('应该正确处理预发布配置', async () => {
      mockApi.config.npm.prerelease = true
      mockApi.config.npm.prereleaseId = 'alpha'
      mockApi.config.npm.confirm = false
      ;(
        getReleaseVersion as MockedFunction<typeof getReleaseVersion>
      ).mockReturnValue('1.1.0-alpha.1')

      const result = await getIncrementVersionHandler({
        releaseTypeOrVersion: 'minor',
      })

      // 当提供了 releaseTypeOrVersion 时，直接使用该类型，不会自动转换为 preminor
      expect(getReleaseVersion).toHaveBeenCalledWith(
        expect.any(String),
        'minor',
        'alpha',
      )
      expect(result).toBe('1.1.0-alpha.1')
    })

    it('应该使用默认的预发布 ID', async () => {
      mockApi.config.npm.prerelease = true
      mockApi.config.npm.confirm = false

      await getIncrementVersionHandler({ releaseTypeOrVersion: 'minor' })

      // 当预发布类型为 true 但没有指定 prereleaseId 时，会使用 undefined
      expect(getReleaseVersion).toHaveBeenCalledWith(
        expect.any(String),
        'minor',
        undefined,
      )
    })

    it('应该处理已经是金丝雀版本的情况', async () => {
      mockApi.config.npm.canary = true
      mockApi.config.npm.confirm = false
      ;(
        isCanaryVersion as MockedFunction<typeof isCanaryVersion>
      ).mockReturnValue(true)
      mockApi.appData.pkgs[0].version = '1.0.0-canary.20231112-old123'

      // 当没有提供 releaseTypeOrVersion 且配置为 canary 模式时，会调用 getCanaryVersion

      await getIncrementVersionHandler({ releaseTypeOrVersion: undefined })

      expect(getCanaryVersion).toHaveBeenCalled()
    })
  })

  describe('远程版本检查测试', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let getIncrementVersionHandler: any

    beforeEach(() => {
      versionPlugin(mockApi)

      getIncrementVersionHandler = mockApi.getIncrementVersion.mock.calls[0][0]
    })

    it('应该获取和使用远程版本信息', async () => {
      mockApi.config.npm.confirm = false
      ;(
        getRemoteDistTag as MockedFunction<typeof getRemoteDistTag>
      ).mockResolvedValue({
        latest: '1.5.0',
        alpha: '1.6.0-alpha.1',
        beta: '1.6.0-beta.1',
        rc: '1.6.0-rc.1',
      })
      ;(getMaxVersion as MockedFunction<typeof getMaxVersion>).mockReturnValue(
        '1.5.0',
      )

      await getIncrementVersionHandler({ releaseTypeOrVersion: 'minor' })

      expect(getRemoteDistTag).toHaveBeenCalledWith(['test-package'], {
        cwd: '/test/project',
        registry: 'https://registry.npmjs.org',
      })
      expect(getMaxVersion).toHaveBeenCalled()
    })

    it('应该处理获取远程版本失败', async () => {
      mockApi.config.npm.confirm = false
      ;(
        getRemoteDistTag as MockedFunction<typeof getRemoteDistTag>
      ).mockRejectedValue(new Error('网络错误'))

      await expect(
        getIncrementVersionHandler({ releaseTypeOrVersion: 'minor' }),
      ).rejects.toThrow('网络错误')
    })
  })

  describe('插件配置验证', () => {
    it('应该正确处理不同的配置组合', async () => {
      const configurations = [
        { canary: true, prerelease: false },
        {
          canary: false,
          prerelease: true,
          prereleaseId: 'alpha' as PrereleaseId,
        },
        {
          canary: false,
          prerelease: true,
          prereleaseId: 'beta' as PrereleaseId,
        },
        { canary: false, prerelease: true, prereleaseId: 'rc' as PrereleaseId },
        { canary: false, prerelease: false },
      ]

      for (const config of configurations) {
        mockApi.config.npm = {
          ...mockApi.config.npm,
          ...config,
          confirm: false,
        }

        versionPlugin(mockApi)

        const getIncrementVersionHandler =
          mockApi.getIncrementVersion.mock.calls[0][0]

        await expect(
          getIncrementVersionHandler({ releaseTypeOrVersion: 'minor' }),
        ).resolves.toBeDefined()

        vi.clearAllMocks()
      }
    })
  })

  describe('插件导出验证', () => {
    it('应该是一个函数', () => {
      expect(typeof versionPlugin).toBe('function')
    })

    it('应该接受 API 参数', () => {
      expect(versionPlugin.length).toBe(1)
    })

    it('应该没有返回值', () => {
      const result = versionPlugin(mockApi)
      expect(result).toBeUndefined()
    })
  })

  describe('版本插件完整工作流', () => {
    it('应该完整执行版本管理流程', async () => {
      versionPlugin(mockApi)

      // 1. 检查版本有效性

      const onCheckHandler = mockApi.onCheck.mock.calls[0][0]

      await onCheckHandler({ releaseTypeOrVersion: 'minor' })
      expect(isVersionValid).toHaveBeenCalled()

      // 2. 获取增量版本
      mockApi.config.npm.confirm = false

      const getIncrementVersionHandler =
        mockApi.getIncrementVersion.mock.calls[0][0]

      const version = await getIncrementVersionHandler({
        releaseTypeOrVersion: 'minor',
      })
      expect(version).toBe('1.1.0')

      // 3. 更新版本

      const onBumpVersionHandler = mockApi.onBumpVersion.mock.calls[0][0]

      await onBumpVersionHandler({
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
      })
      expect(updatePackageVersion).toHaveBeenCalled()

      // 4. 更新锁文件

      const onAfterBumpVersionHandler =
        mockApi.onAfterBumpVersion.mock.calls[0][0]

      await onAfterBumpVersionHandler({
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
      })
      expect(updatePackageLock).toHaveBeenCalled()
    })

    it('应该处理错误情况', async () => {
      versionPlugin(mockApi)

      // 测试无效版本错误
      ;(
        isVersionValid as MockedFunction<typeof isVersionValid>
      ).mockReturnValue(false)

      const onCheckHandler = mockApi.onCheck.mock.calls[0][0]

      await expect(
        onCheckHandler({ releaseTypeOrVersion: 'invalid' }),
      ).rejects.toThrow()

      // 测试版本更新错误
      ;(
        updatePackageVersion as MockedFunction<typeof updatePackageVersion>
      ).mockRejectedValue(new Error('更新失败'))

      const onBumpVersionHandler = mockApi.onBumpVersion.mock.calls[0][0]

      await expect(
        onBumpVersionHandler({
          version: '1.1.0',
          isPrerelease: false,
          prereleaseId: null,
        }),
      ).rejects.toThrow('更新失败')
    })
  })

  describe('版本增量计算扩展测试', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let getIncrementVersionHandler: any

    beforeEach(() => {
      versionPlugin(mockApi)

      getIncrementVersionHandler = mockApi.getIncrementVersion.mock.calls[0][0]
    })

    it('应该正确处理不同的远程版本信息显示', async () => {
      mockApi.config.npm.canary = false
      mockApi.config.npm.confirm = false
      ;(
        getRemoteDistTag as MockedFunction<typeof getRemoteDistTag>
      ).mockResolvedValue({
        latest: '1.0.5',
        alpha: '1.1.0-alpha.1',
        beta: '1.1.0-beta.1',
        rc: '1.1.0-rc.1',
      })
      ;(prompts as MockedFunction<typeof prompts>).mockResolvedValue({
        value: '1.0.6',
      })

      await getIncrementVersionHandler({ releaseTypeOrVersion: undefined })

      expect(logger.info).toHaveBeenCalledWith(
        'Local version: [cyan]1.0.0[/cyan]',
      )
      expect(logger.info).toHaveBeenCalledWith(
        'Remote latest version: [cyan]1.0.5[/cyan]',
      )
      expect(logger.info).toHaveBeenCalledWith(
        'Remote alpha version: [cyan]1.1.0-alpha.1[/cyan]',
      )
      expect(logger.info).toHaveBeenCalledWith(
        'Remote beta version: [cyan]1.1.0-beta.1[/cyan]',
      )
      expect(logger.info).toHaveBeenCalledWith(
        'Remote rc version: [cyan]1.1.0-rc.1[/cyan]',
      )
    })

    it('应该在指定预发布ID时只显示对应的远程版本', async () => {
      mockApi.config.npm.canary = false
      mockApi.config.npm.prereleaseId = 'alpha'
      mockApi.config.npm.confirm = false
      ;(
        getRemoteDistTag as MockedFunction<typeof getRemoteDistTag>
      ).mockResolvedValue({
        latest: '1.0.5',
        alpha: '1.1.0-alpha.1',
        beta: '1.1.0-beta.1',
        rc: '1.1.0-rc.1',
      })
      ;(prompts as MockedFunction<typeof prompts>).mockResolvedValue({
        value: '1.1.0-alpha.2',
      })

      await getIncrementVersionHandler({ releaseTypeOrVersion: undefined })

      expect(logger.info).toHaveBeenCalledWith(
        'Remote alpha version: [cyan]1.1.0-alpha.1[/cyan]',
      )
      expect(logger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Remote beta version'),
      )
      expect(logger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Remote rc version'),
      )
    })
  })
})
