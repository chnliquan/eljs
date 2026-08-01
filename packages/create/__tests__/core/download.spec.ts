import {
  downloadGitRepository,
  downloadNpmTarball,
  findUp,
  getNpmPackage,
  getNpmRequestConfig,
  pkgNameAnalysis,
  readJson,
  remove,
  run,
  type PackageJson,
} from '@eljs/utils'
import path from 'node:path'
import ora from 'ora'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
  type MockedFunction,
} from 'vitest'

import {
  TemplateDownloader,
  type TemplateDownloadOptions,
} from '../../src/core/template-downloader'
import type { RemoteTemplate } from '../../src/types'

// Mock external dependencies
vi.mock('@eljs/utils/cp', async () => import('@eljs/utils'))
vi.mock('@eljs/utils/file', async () => import('@eljs/utils'))
vi.mock('@eljs/utils/git', async () => import('@eljs/utils'))
vi.mock('@eljs/utils/logger', async () => import('@eljs/utils'))
vi.mock('@eljs/utils/module', async () => import('@eljs/utils'))
vi.mock('@eljs/utils/npm', async () => import('@eljs/utils'))
vi.mock('@eljs/utils', () => ({
  chalk: {
    cyan: vi.fn((text: string) => text),
  },
  downloadGitRepository: vi.fn(),
  downloadNpmTarball: vi.fn(),
  findUp: vi.fn(),
  getNpmPackage: vi.fn(),
  getNpmRequestConfig: vi.fn(),
  pkgNameAnalysis: vi.fn(),
  readJson: vi.fn(),
  remove: vi.fn(),
  run: vi.fn(),
}))
vi.mock('ora')
vi.mock('node:path')

describe('TemplateDownloader 类测试', () => {
  // Mock implementations
  const mockGetNpmPackage = getNpmPackage as MockedFunction<
    typeof getNpmPackage
  >
  const mockGetNpmRequestConfig = getNpmRequestConfig as MockedFunction<
    typeof getNpmRequestConfig
  >
  const mockPkgNameAnalysis = pkgNameAnalysis as MockedFunction<
    typeof pkgNameAnalysis
  >
  const mockDownloadNpmTarball = downloadNpmTarball as MockedFunction<
    typeof downloadNpmTarball
  >
  const mockDownloadGitRepository = downloadGitRepository as MockedFunction<
    typeof downloadGitRepository
  >
  const mockFindUp = findUp as MockedFunction<typeof findUp>
  const mockReadJson = readJson as MockedFunction<typeof readJson>
  const mockRemove = remove as MockedFunction<typeof remove>
  const mockRun = run as MockedFunction<typeof run>
  const mockOra = ora as MockedFunction<typeof ora>

  // Mock spinner
  const mockSpinner = {
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
  }

  // Test data
  const mockCwd = '/test/cwd'
  const mockDownloadPath = '/tmp/download/path'
  const mockPackageName = 'test-package'
  const mockVersion = '1.0.0'
  const mockTarball =
    'https://registry.npmjs.org/test-package/-/test-package-1.0.0.tgz'
  const mockGitUrl = 'https://github.com/user/repo.git'

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock ora to return our mock spinner
    mockOra.mockReturnValue(mockSpinner as unknown as ReturnType<typeof ora>)

    // Mock path.join to handle package.json path correctly
    vi.mocked(path.join).mockImplementation((dir, file) => {
      if (file === 'package.json') {
        return `${dir}/package.json`
      }
      return `${dir}/${file}`
    })
    vi.mocked(path.dirname).mockReturnValue('/tmp/download')

    // Default successful mocks
    mockPkgNameAnalysis.mockReturnValue({
      name: mockPackageName,
      version: mockVersion,
      scope: '',
      unscopedName: mockPackageName,
    })

    mockGetNpmPackage.mockResolvedValue({
      name: mockPackageName,
      version: mockVersion,
      dist: { integrity: 'sha512-template-integrity', tarball: mockTarball },
    } as unknown as Awaited<ReturnType<typeof getNpmPackage>>)
    mockGetNpmRequestConfig.mockResolvedValue({
      headers: { authorization: 'Bearer template-token' },
      proxy: 'http://proxy.example.com:8080',
    })

    mockDownloadNpmTarball.mockResolvedValue(mockDownloadPath)
    mockDownloadGitRepository.mockResolvedValue(mockDownloadPath)
    mockFindUp.mockResolvedValue(undefined)
    mockReadJson.mockResolvedValue({})
    mockRemove.mockResolvedValue(true)
    mockRun.mockResolvedValue({} as unknown as Awaited<ReturnType<typeof run>>)
  })

  describe('构造函数测试', () => {
    it('应该使用npm选项初始化', () => {
      const options: TemplateDownloadOptions = {
        type: 'npm',
        value: mockPackageName,
        cwd: mockCwd,
      }

      const download = new TemplateDownloader(options)

      expect(download.constructorOptions).toEqual(options)
      expect(Object.isFrozen(download.constructorOptions)).toBe(true)
    })

    it('应该使用git选项初始化', () => {
      const options: TemplateDownloadOptions = {
        type: 'git',
        value: mockGitUrl,
      }

      const download = new TemplateDownloader(options)

      expect(download.constructorOptions).toEqual(options)
      expect(Object.isFrozen(download.constructorOptions)).toBe(true)
    })

    it('应该使用registry选项初始化', () => {
      const options: TemplateDownloadOptions = {
        type: 'npm',
        value: mockPackageName,
        registry: 'https://custom-registry.com',
      }

      const download = new TemplateDownloader(options)

      expect(download.constructorOptions.registry).toBe(
        'https://custom-registry.com',
      )
    })

    it('应该在没有cwd选项时初始化', () => {
      const options: TemplateDownloadOptions = {
        type: 'npm',
        value: mockPackageName,
      }

      const download = new TemplateDownloader(options)

      expect(download.constructorOptions.cwd).toBeUndefined()
    })

    it('应该初始化spinner', () => {
      const options: TemplateDownloadOptions = {
        type: 'npm',
        value: mockPackageName,
      }

      expect(() => new TemplateDownloader(options)).not.toThrow()
      expect(mockOra).toHaveBeenCalled()
    })
  })

  describe('download 方法测试', () => {
    describe('npm 类型', () => {
      it('应该成功下载npm包', async () => {
        const options: TemplateDownloadOptions = {
          type: 'npm',
          value: mockPackageName,
          cwd: mockCwd,
        }
        const download = new TemplateDownloader(options)

        const result = await download.download()

        expect(result).toBe(mockDownloadPath)
        expect(mockPkgNameAnalysis).toHaveBeenCalledWith(mockPackageName)
        expect(mockGetNpmPackage).toHaveBeenCalledWith(mockPackageName, {
          cwd: mockCwd,
          version: mockVersion,
          registry: undefined,
        })
        expect(mockGetNpmRequestConfig).toHaveBeenCalledWith(
          mockTarball,
          mockCwd,
        )
        expect(mockDownloadNpmTarball).toHaveBeenCalledWith(mockTarball, {
          headers: { authorization: 'Bearer template-token' },
          integrity: 'sha512-template-integrity',
          maxBytes: 104_857_600,
          maxEntries: 20_000,
          maxUnpackedBytes: 524_288_000,
          proxy: 'http://proxy.example.com:8080',
        })
      })

      it('应该使用自定义registry下载npm包', async () => {
        const customRegistry = 'https://custom-registry.com'
        const options: TemplateDownloadOptions = {
          type: 'npm',
          value: mockPackageName,
          registry: customRegistry,
          cwd: mockCwd,
        }
        const download = new TemplateDownloader(options)

        await download.download()

        expect(mockGetNpmPackage).toHaveBeenCalledWith(mockPackageName, {
          cwd: mockCwd,
          version: mockVersion,
          registry: customRegistry,
        })
      })

      it('应该处理包未找到错误', async () => {
        const packageName = 'non-existent-package'
        const options: TemplateDownloadOptions = {
          type: 'npm',
          value: packageName,
        }
        const download = new TemplateDownloader(options)

        // Mock package name analysis for this specific package
        mockPkgNameAnalysis.mockReturnValueOnce({
          name: packageName,
          version: mockVersion,
          scope: '',
          unscopedName: packageName,
        })
        mockGetNpmPackage.mockResolvedValue(null)

        await expect(download.download()).rejects.toThrow(
          `Access ${packageName}@${mockVersion} failed.`,
        )
      })

      it('应该处理不带版本的包', async () => {
        mockPkgNameAnalysis.mockReturnValue({
          name: mockPackageName,
          version: '1.0.0',
          scope: '',
          unscopedName: mockPackageName,
        })

        const options: TemplateDownloadOptions = {
          type: 'npm',
          value: mockPackageName,
        }
        const download = new TemplateDownloader(options)

        await download.download()

        expect(mockGetNpmPackage).toHaveBeenCalledWith(mockPackageName, {
          cwd: undefined,
          version: '1.0.0',
          registry: undefined,
        })
      })

      it('应该处理下载失败', async () => {
        const options: TemplateDownloadOptions = {
          type: 'npm',
          value: mockPackageName,
        }
        const download = new TemplateDownloader(options)

        const downloadError = new Error('Network error')
        mockDownloadNpmTarball.mockRejectedValue(downloadError)

        await expect(download.download()).rejects.toThrow('Network error')
        expect(mockSpinner.fail).toHaveBeenCalled()
      })

      it('应该处理作用域包', async () => {
        const scopedPackage = '@scope/package'
        const options: TemplateDownloadOptions = {
          type: 'npm',
          value: scopedPackage,
        }

        mockPkgNameAnalysis.mockReturnValue({
          name: scopedPackage,
          version: mockVersion,
          scope: '@scope',
          unscopedName: 'package',
        })

        const download = new TemplateDownloader(options)

        await download.download()

        expect(mockPkgNameAnalysis).toHaveBeenCalledWith(scopedPackage)
        expect(mockGetNpmPackage).toHaveBeenCalledWith(scopedPackage, {
          cwd: undefined,
          version: mockVersion,
          registry: undefined,
        })
      })

      it('应该处理指定版本的包', async () => {
        const packageWithVersion = 'test-package@2.0.0'
        const options: TemplateDownloadOptions = {
          type: 'npm',
          value: packageWithVersion,
        }

        mockPkgNameAnalysis.mockReturnValue({
          name: 'test-package',
          version: '2.0.0',
          scope: '',
          unscopedName: 'test-package',
        })

        mockGetNpmPackage.mockResolvedValue({
          name: 'test-package',
          version: '2.0.0',
          dist: {
            tarball:
              'https://registry.npmjs.org/test-package/-/test-package-2.0.0.tgz',
          },
        } as unknown as Awaited<ReturnType<typeof getNpmPackage>>)

        const download = new TemplateDownloader(options)

        await download.download()

        expect(mockGetNpmPackage).toHaveBeenCalledWith('test-package', {
          cwd: undefined,
          version: '2.0.0',
          registry: undefined,
        })
      })
    })

    describe('git 类型', () => {
      it('应该成功下载git仓库', async () => {
        const options: TemplateDownloadOptions = {
          type: 'git',
          value: mockGitUrl,
        }
        const download = new TemplateDownloader(options)

        const result = await download.download()

        expect(result).toBe(mockDownloadPath)
        expect(mockDownloadGitRepository).toHaveBeenCalledWith(mockGitUrl)
      })

      it('应该处理git下载失败', async () => {
        const options: TemplateDownloadOptions = {
          type: 'git',
          value: mockGitUrl,
        }
        const download = new TemplateDownloader(options)

        const gitError = new Error('Git clone failed')
        mockDownloadGitRepository.mockRejectedValue(gitError)

        await expect(download.download()).rejects.toThrow('Git clone failed')
        expect(mockSpinner.fail).toHaveBeenCalled()
      })

      it('应该处理不同的git URL格式', async () => {
        const gitUrls = [
          'https://github.com/user/repo.git',
          'git@github.com:user/repo.git',
          'https://gitlab.com/user/repo.git',
        ]

        for (const gitUrl of gitUrls) {
          const options: TemplateDownloadOptions = {
            type: 'git',
            value: gitUrl,
          }
          const download = new TemplateDownloader(options)

          await download.download()

          expect(mockDownloadGitRepository).toHaveBeenCalledWith(gitUrl)
        }
      })
    })

    describe('无效类型', () => {
      it('应该为无效下载类型抛出错误', async () => {
        const options = {
          type: 'invalid' as unknown as 'npm' | 'git',
          value: 'test',
        }
        const download = new TemplateDownloader(options)

        await expect(download.download()).rejects.toThrow(
          'TemplateDownloader type must be `npm` or `git`, but got `invalid`.',
        )
      })
    })
  })

  describe('依赖安装测试', () => {
    describe('有依赖时', () => {
      const mockPackageJson: PackageJson = {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {
          dep1: '^1.0.0',
          dep2: '^2.0.0',
        },
      }

      it('当package.json有依赖时应该安装依赖', async () => {
        mockReadJson.mockResolvedValue(mockPackageJson)

        const options: TemplateDownloadOptions = {
          type: 'npm',
          value: mockPackageName,
        }
        const download = new TemplateDownloader(options)

        await download.download()

        expect(mockReadJson).toHaveBeenCalledWith(
          path.join(mockDownloadPath, './package.json'),
        )
        expect(mockRun).toHaveBeenCalledWith(
          'npm',
          ['install', '--omit=dev', '--ignore-scripts'],
          {
            cwd: mockDownloadPath,
          },
        )
      })

      it('应该把调用方项目的 npmrc 作为模板安装用户配置', async () => {
        mockReadJson.mockResolvedValue(mockPackageJson)
        mockFindUp.mockResolvedValue('/test/cwd/.npmrc')
        const download = new TemplateDownloader({
          cwd: mockCwd,
          type: 'npm',
          value: mockPackageName,
        })

        await download.download()

        expect(mockFindUp).toHaveBeenCalledWith('.npmrc', { cwd: mockCwd })
        expect(mockRun).toHaveBeenCalledWith(
          'npm',
          ['install', '--omit=dev', '--ignore-scripts'],
          {
            cwd: mockDownloadPath,
            env: { NPM_CONFIG_USERCONFIG: '/test/cwd/.npmrc' },
          },
        )
      })

      it('应该处理安装失败', async () => {
        mockReadJson.mockResolvedValue(mockPackageJson)
        const installError = new Error('Installation failed')
        mockRun.mockRejectedValue(installError)

        const options: TemplateDownloadOptions = {
          type: 'npm',
          value: mockPackageName,
        }
        const download = new TemplateDownloader(options)

        await expect(download.download()).rejects.toThrow('Installation failed')
        expect(mockSpinner.fail).toHaveBeenCalled()
        expect(mockRemove).toHaveBeenCalledWith(mockDownloadPath)
      })

      it('应该为git仓库安装依赖', async () => {
        mockReadJson.mockResolvedValue(mockPackageJson)

        const options: TemplateDownloadOptions = {
          type: 'git',
          value: mockGitUrl,
        }
        const download = new TemplateDownloader(options)

        await download.download()

        expect(mockReadJson).toHaveBeenCalledWith(
          path.join(mockDownloadPath, './package.json'),
        )
        expect(mockRun).toHaveBeenCalledWith(
          'npm',
          ['install', '--omit=dev', '--ignore-scripts'],
          {
            cwd: mockDownloadPath,
          },
        )
      })

      it('只有显式允许时才执行模板依赖的生命周期脚本', async () => {
        mockReadJson.mockResolvedValue(mockPackageJson)

        const download = new TemplateDownloader({
          type: 'npm',
          value: mockPackageName,
          allowScripts: true,
        })

        await download.download()

        expect(mockRun).toHaveBeenCalledWith('npm', ['install', '--omit=dev'], {
          cwd: mockDownloadPath,
        })
      })
    })

    describe('无依赖时', () => {
      it('当无依赖时应该跳过安装', async () => {
        const packageJsonNoDeps: PackageJson = {
          name: 'test-package',
          version: '1.0.0',
        }
        mockReadJson.mockResolvedValue(packageJsonNoDeps)

        const options: TemplateDownloadOptions = {
          type: 'npm',
          value: mockPackageName,
        }
        const download = new TemplateDownloader(options)

        await download.download()

        expect(mockRun).not.toHaveBeenCalled()
      })

      it('当依赖对象为空时应该跳过安装', async () => {
        const packageJsonEmptyDeps: PackageJson = {
          name: 'test-package',
          version: '1.0.0',
          dependencies: {},
        }
        mockReadJson.mockResolvedValue(packageJsonEmptyDeps)

        const options: TemplateDownloadOptions = {
          type: 'npm',
          value: mockPackageName,
        }
        const download = new TemplateDownloader(options)

        await download.download()

        expect(mockRun).not.toHaveBeenCalled()
      })

      it('当package.json不存在时应该跳过安装', async () => {
        mockReadJson.mockResolvedValue({})

        const options: TemplateDownloadOptions = {
          type: 'npm',
          value: mockPackageName,
        }
        const download = new TemplateDownloader(options)

        await download.download()

        expect(mockRun).not.toHaveBeenCalled()
      })

      it('应该优雅处理package.json读取错误', async () => {
        mockReadJson.mockRejectedValue(new Error('File read error'))

        const options: TemplateDownloadOptions = {
          type: 'npm',
          value: mockPackageName,
        }
        const download = new TemplateDownloader(options)

        await expect(download.download()).rejects.toThrow('File read error')
        expect(mockRemove).toHaveBeenCalledWith(mockDownloadPath)
      })
    })
  })

  describe('集成测试', () => {
    it('应该处理带依赖的完整npm下载流程', async () => {
      const packageJsonWithDeps: PackageJson = {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {
          lodash: '^4.17.21',
        },
      }
      mockReadJson.mockResolvedValue(packageJsonWithDeps)

      const options: TemplateDownloadOptions = {
        type: 'npm',
        value: `${mockPackageName}@${mockVersion}`,
        registry: 'https://registry.npmjs.org',
        cwd: mockCwd,
      }
      const download = new TemplateDownloader(options)

      const result = await download.download()

      expect(result).toBe(mockDownloadPath)

      // Verify complete flow
      expect(mockPkgNameAnalysis).toHaveBeenCalledWith(
        `${mockPackageName}@${mockVersion}`,
      )
      expect(mockGetNpmPackage).toHaveBeenCalledWith(mockPackageName, {
        cwd: mockCwd,
        version: mockVersion,
        registry: 'https://registry.npmjs.org',
      })
      expect(mockDownloadNpmTarball).toHaveBeenCalledWith(
        mockTarball,
        expect.objectContaining({
          integrity: 'sha512-template-integrity',
          maxBytes: 104_857_600,
          maxEntries: 20_000,
        }),
      )
      expect(mockReadJson).toHaveBeenCalledWith(
        path.join(mockDownloadPath, './package.json'),
      )
      expect(mockRun).toHaveBeenCalledWith(
        'npm',
        ['install', '--omit=dev', '--ignore-scripts'],
        {
          cwd: mockDownloadPath,
        },
      )
    })

    it('应该处理完整的git下载流程', async () => {
      const options: TemplateDownloadOptions = {
        type: 'git',
        value: mockGitUrl,
      }
      const download = new TemplateDownloader(options)

      const result = await download.download()

      expect(result).toBe(mockDownloadPath)
      expect(mockDownloadGitRepository).toHaveBeenCalledWith(mockGitUrl)
      expect(mockReadJson).toHaveBeenCalledWith(
        path.join(mockDownloadPath, './package.json'),
      )
    })

    it('应该处理无安装的npm下载', async () => {
      mockReadJson.mockResolvedValue({}) // No package.json

      const options: TemplateDownloadOptions = {
        type: 'npm',
        value: mockPackageName,
      }
      const download = new TemplateDownloader(options)

      const result = await download.download()

      expect(result).toBe(mockDownloadPath)
      expect(mockDownloadNpmTarball).toHaveBeenCalledWith(
        mockTarball,
        expect.objectContaining({
          integrity: 'sha512-template-integrity',
          maxBytes: 104_857_600,
          maxEntries: 20_000,
        }),
      )
      expect(mockRun).not.toHaveBeenCalled()
    })
  })

  describe('spinner 行为测试', () => {
    it('成功下载时应该按正确顺序调用spinner方法', async () => {
      const options: TemplateDownloadOptions = {
        type: 'npm',
        value: mockPackageName,
      }
      const download = new TemplateDownloader(options)

      await download.download()

      const startCalls = (mockSpinner.start as Mock).mock.calls
      const succeedCalls = (mockSpinner.succeed as Mock).mock.calls

      expect(startCalls.length).toBeGreaterThan(0)
      expect(succeedCalls.length).toBeGreaterThan(0)
      expect(mockSpinner.fail).not.toHaveBeenCalled()
    })

    it('下载失败时应该调用fail方法', async () => {
      mockDownloadNpmTarball.mockRejectedValue(new Error('Network error'))

      const options: TemplateDownloadOptions = {
        type: 'npm',
        value: mockPackageName,
      }
      const download = new TemplateDownloader(options)

      await expect(download.download()).rejects.toThrow()

      expect(mockSpinner.start).toHaveBeenCalled()
      expect(mockSpinner.fail).toHaveBeenCalled()
      expect(mockSpinner.succeed).not.toHaveBeenCalled()
    })

    it('git下载失败时应该调用fail方法', async () => {
      mockDownloadGitRepository.mockRejectedValue(new Error('Git error'))

      const options: TemplateDownloadOptions = {
        type: 'git',
        value: mockGitUrl,
      }
      const download = new TemplateDownloader(options)

      await expect(download.download()).rejects.toThrow()

      expect(mockSpinner.start).toHaveBeenCalled()
      expect(mockSpinner.fail).toHaveBeenCalled()
      expect(mockSpinner.succeed).not.toHaveBeenCalled()
    })
  })

  describe('属性和类型安全测试', () => {
    it('应该具有所有必需属性', () => {
      const options: TemplateDownloadOptions = {
        type: 'npm',
        value: mockPackageName,
      }

      const download = new TemplateDownloader(options)

      expect(download).toHaveProperty('constructorOptions')
      expect('_spinner' in download).toBe(true)
    })

    it('应该正确存储构造函数选项', () => {
      const options: TemplateDownloadOptions = {
        type: 'git',
        value: mockGitUrl,
        cwd: mockCwd,
      }

      const download = new TemplateDownloader(options)

      expect(download.constructorOptions.type).toBe('git')
      expect(download.constructorOptions.value).toBe(mockGitUrl)
      expect(download.constructorOptions.cwd).toBe(mockCwd)
    })

    it('应该接受有效的npm TemplateDownloadOptions', () => {
      const options: TemplateDownloadOptions = {
        type: 'npm',
        value: 'package-name',
        registry: 'https://registry.npmjs.org',
        cwd: '/some/path',
      }

      expect(() => new TemplateDownloader(options)).not.toThrow()
    })

    it('应该接受有效的git TemplateDownloadOptions', () => {
      const options: TemplateDownloadOptions = {
        type: 'git',
        value: 'https://github.com/user/repo.git',
      }

      expect(() => new TemplateDownloader(options)).not.toThrow()
    })

    it('应该扩展RemoteTemplate接口', () => {
      const remoteTemplate: RemoteTemplate = {
        type: 'npm',
        value: 'test-package',
      }

      const options: TemplateDownloadOptions = {
        ...remoteTemplate,
        cwd: '/test',
      }

      expect(() => new TemplateDownloader(options)).not.toThrow()
    })

    it('应该维护正确的属性类型', () => {
      const options: TemplateDownloadOptions = {
        type: 'npm',
        value: mockPackageName,
        cwd: mockCwd,
      }

      const download = new TemplateDownloader(options)

      expect(typeof download.constructorOptions.type).toBe('string')
      expect(typeof download.constructorOptions.value).toBe('string')
      expect(typeof download.constructorOptions.cwd).toBe('string')
    })

    it('应该有download方法', () => {
      const download = new TemplateDownloader({ type: 'npm', value: 'test' })
      expect(typeof download.download).toBe('function')
    })
  })

  describe('配置验证', () => {
    it('应该正确处理npm类型', () => {
      const options: TemplateDownloadOptions = {
        type: 'npm',
        value: 'my-package',
      }

      const download = new TemplateDownloader(options)

      expect(download.constructorOptions.type).toBe('npm')
    })

    it('应该正确处理git类型', () => {
      const options: TemplateDownloadOptions = {
        type: 'git',
        value: 'https://github.com/user/repo.git',
      }

      const download = new TemplateDownloader(options)

      expect(download.constructorOptions.type).toBe('git')
    })

    it('应该处理不同的包名', () => {
      const testCases = [
        'simple-package',
        '@scope/package',
        'package@1.0.0',
        '@scope/package@latest',
      ]

      testCases.forEach(packageName => {
        const options: TemplateDownloadOptions = {
          type: 'npm',
          value: packageName,
        }

        expect(() => new TemplateDownloader(options)).not.toThrow()
        const download = new TemplateDownloader(options)
        expect(download.constructorOptions.value).toBe(packageName)
      })
    })

    it('应该处理不同的git URL', () => {
      const testCases = [
        'https://github.com/user/repo.git',
        'git@github.com:user/repo.git',
        'https://gitlab.com/user/repo.git',
      ]

      testCases.forEach(gitUrl => {
        const options: TemplateDownloadOptions = {
          type: 'git',
          value: gitUrl,
        }

        expect(() => new TemplateDownloader(options)).not.toThrow()
        const download = new TemplateDownloader(options)
        expect(download.constructorOptions.value).toBe(gitUrl)
      })
    })
  })

  describe('registry 处理测试', () => {
    it('应该为npm接受自定义registry', () => {
      const customRegistry = 'https://my-custom-registry.com'
      const options: TemplateDownloadOptions = {
        type: 'npm',
        value: 'test-package',
        registry: customRegistry,
      }

      const download = new TemplateDownloader(options)

      expect(download.constructorOptions.registry).toBe(customRegistry)
    })

    it('应该在没有registry的情况下工作', () => {
      const options: TemplateDownloadOptions = {
        type: 'npm',
        value: 'test-package',
      }

      const download = new TemplateDownloader(options)

      expect(download.constructorOptions.registry).toBeUndefined()
    })

    it('对于git类型应该忽略registry', () => {
      const options: TemplateDownloadOptions = {
        type: 'git',
        value: 'https://github.com/user/repo.git',
        registry: 'https://should-be-ignored.com',
      }

      const download = new TemplateDownloader(options)

      // Registry should still be there but not relevant for git
      expect(download.constructorOptions.registry).toBe(
        'https://should-be-ignored.com',
      )
    })
  })
})
