import {
  downloadGitRepository,
  downloadNpmTarball,
  getNpmPackage,
  pkgNameAnalysis,
  readJson,
  run,
  type PackageJson,
} from '@eljs/utils'
import path from 'node:path'
import ora from 'ora'

import { Download, type DownloadOptions } from '../../src/core/download'
import type { RemoteTemplate } from '../../src/types'

// Mock external dependencies
jest.mock('@eljs/utils')
jest.mock('ora')
jest.mock('node:path')

describe('Download 类测试', () => {
  // Mock implementations
  const mockGetNpmPackage = getNpmPackage as jest.MockedFunction<
    typeof getNpmPackage
  >
  const mockPkgNameAnalysis = pkgNameAnalysis as jest.MockedFunction<
    typeof pkgNameAnalysis
  >
  const mockDownloadNpmTarball = downloadNpmTarball as jest.MockedFunction<
    typeof downloadNpmTarball
  >
  const mockDownloadGitRepository =
    downloadGitRepository as jest.MockedFunction<typeof downloadGitRepository>
  const mockReadJson = readJson as jest.MockedFunction<typeof readJson>
  const mockRun = run as jest.MockedFunction<typeof run>
  const mockOra = ora as jest.MockedFunction<typeof ora>

  // Mock spinner
  const mockSpinner = {
    start: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
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
    jest.clearAllMocks()

    // Mock ora to return our mock spinner
    mockOra.mockReturnValue(mockSpinner as unknown as ReturnType<typeof ora>)

    // Mock path.join to handle package.json path correctly
    jest.mocked(path.join).mockImplementation((dir, file) => {
      if (file === 'package.json') {
        return `${dir}/package.json`
      }
      return `${dir}/${file}`
    })

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
      dist: { tarball: mockTarball },
    } as unknown as Awaited<ReturnType<typeof getNpmPackage>>)

    mockDownloadNpmTarball.mockResolvedValue(mockDownloadPath)
    mockDownloadGitRepository.mockResolvedValue(mockDownloadPath)
    mockReadJson.mockResolvedValue({})
    mockRun.mockResolvedValue({} as unknown as Awaited<ReturnType<typeof run>>)
  })

  describe('构造函数测试', () => {
    it('应该使用npm选项初始化', () => {
      const options: DownloadOptions = {
        type: 'npm',
        value: mockPackageName,
        cwd: mockCwd,
      }

      const download = new Download(options)

      expect(download.constructorOptions).toBe(options)
    })

    it('应该使用git选项初始化', () => {
      const options: DownloadOptions = {
        type: 'git',
        value: mockGitUrl,
      }

      const download = new Download(options)

      expect(download.constructorOptions).toBe(options)
    })

    it('应该使用registry选项初始化', () => {
      const options: DownloadOptions = {
        type: 'npm',
        value: mockPackageName,
        registry: 'https://custom-registry.com',
      }

      const download = new Download(options)

      expect(download.constructorOptions.registry).toBe(
        'https://custom-registry.com',
      )
    })

    it('应该在没有cwd选项时初始化', () => {
      const options: DownloadOptions = {
        type: 'npm',
        value: mockPackageName,
      }

      const download = new Download(options)

      expect(download.constructorOptions.cwd).toBeUndefined()
    })

    it('应该初始化spinner', () => {
      const options: DownloadOptions = {
        type: 'npm',
        value: mockPackageName,
      }

      expect(() => new Download(options)).not.toThrow()
      expect(mockOra).toHaveBeenCalled()
    })
  })

  describe('download 方法测试', () => {
    describe('npm 类型', () => {
      it('应该成功下载npm包', async () => {
        const options: DownloadOptions = {
          type: 'npm',
          value: mockPackageName,
          cwd: mockCwd,
        }
        const download = new Download(options)

        const result = await download.download()

        expect(result).toBe(mockDownloadPath)
        expect(mockPkgNameAnalysis).toHaveBeenCalledWith(mockPackageName)
        expect(mockGetNpmPackage).toHaveBeenCalledWith(mockPackageName, {
          cwd: mockCwd,
          version: mockVersion,
          registry: undefined,
        })
        expect(mockDownloadNpmTarball).toHaveBeenCalledWith(mockTarball)
      })

      it('应该使用自定义registry下载npm包', async () => {
        const customRegistry = 'https://custom-registry.com'
        const options: DownloadOptions = {
          type: 'npm',
          value: mockPackageName,
          registry: customRegistry,
          cwd: mockCwd,
        }
        const download = new Download(options)

        await download.download()

        expect(mockGetNpmPackage).toHaveBeenCalledWith(mockPackageName, {
          cwd: mockCwd,
          version: mockVersion,
          registry: customRegistry,
        })
      })

      it('应该处理包未找到错误', async () => {
        const packageName = 'non-existent-package'
        const options: DownloadOptions = {
          type: 'npm',
          value: packageName,
        }
        const download = new Download(options)

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

        const options: DownloadOptions = {
          type: 'npm',
          value: mockPackageName,
        }
        const download = new Download(options)

        await download.download()

        expect(mockGetNpmPackage).toHaveBeenCalledWith(mockPackageName, {
          cwd: undefined,
          version: '1.0.0',
          registry: undefined,
        })
      })

      it('应该处理下载失败', async () => {
        const options: DownloadOptions = {
          type: 'npm',
          value: mockPackageName,
        }
        const download = new Download(options)

        const downloadError = new Error('Network error')
        mockDownloadNpmTarball.mockRejectedValue(downloadError)

        await expect(download.download()).rejects.toThrow('Network error')
        expect(mockSpinner.fail).toHaveBeenCalled()
      })

      it('应该处理作用域包', async () => {
        const scopedPackage = '@scope/package'
        const options: DownloadOptions = {
          type: 'npm',
          value: scopedPackage,
        }

        mockPkgNameAnalysis.mockReturnValue({
          name: scopedPackage,
          version: mockVersion,
          scope: '@scope',
          unscopedName: 'package',
        })

        const download = new Download(options)

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
        const options: DownloadOptions = {
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

        const download = new Download(options)

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
        const options: DownloadOptions = {
          type: 'git',
          value: mockGitUrl,
        }
        const download = new Download(options)

        const result = await download.download()

        expect(result).toBe(mockDownloadPath)
        expect(mockDownloadGitRepository).toHaveBeenCalledWith(mockGitUrl)
      })

      it('应该处理git下载失败', async () => {
        const options: DownloadOptions = {
          type: 'git',
          value: mockGitUrl,
        }
        const download = new Download(options)

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
          const options: DownloadOptions = {
            type: 'git',
            value: gitUrl,
          }
          const download = new Download(options)

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
        const download = new Download(options)

        await expect(download.download()).rejects.toThrow(
          'Download type must be `npm` or `git`, but got `invalid`.',
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

        const options: DownloadOptions = {
          type: 'npm',
          value: mockPackageName,
        }
        const download = new Download(options)

        await download.download()

        expect(mockReadJson).toHaveBeenCalledWith(
          path.join(mockDownloadPath, './package.json'),
        )
        expect(mockRun).toHaveBeenCalledWith(
          'npm',
          ['install', '--production'],
          {
            cwd: mockDownloadPath,
          },
        )
      })

      it('应该处理安装失败', async () => {
        mockReadJson.mockResolvedValue(mockPackageJson)
        const installError = new Error('Installation failed')
        mockRun.mockRejectedValue(installError)

        const options: DownloadOptions = {
          type: 'npm',
          value: mockPackageName,
        }
        const download = new Download(options)

        await expect(download.download()).rejects.toThrow('Installation failed')
        expect(mockSpinner.fail).toHaveBeenCalled()
      })

      it('应该为git仓库安装依赖', async () => {
        mockReadJson.mockResolvedValue(mockPackageJson)

        const options: DownloadOptions = {
          type: 'git',
          value: mockGitUrl,
        }
        const download = new Download(options)

        await download.download()

        expect(mockReadJson).toHaveBeenCalledWith(
          path.join(mockDownloadPath, './package.json'),
        )
        expect(mockRun).toHaveBeenCalledWith(
          'npm',
          ['install', '--production'],
          {
            cwd: mockDownloadPath,
          },
        )
      })
    })

    describe('无依赖时', () => {
      it('当无依赖时应该跳过安装', async () => {
        const packageJsonNoDeps: PackageJson = {
          name: 'test-package',
          version: '1.0.0',
        }
        mockReadJson.mockResolvedValue(packageJsonNoDeps)

        const options: DownloadOptions = {
          type: 'npm',
          value: mockPackageName,
        }
        const download = new Download(options)

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

        const options: DownloadOptions = {
          type: 'npm',
          value: mockPackageName,
        }
        const download = new Download(options)

        await download.download()

        expect(mockRun).not.toHaveBeenCalled()
      })

      it('当package.json不存在时应该跳过安装', async () => {
        mockReadJson.mockResolvedValue({})

        const options: DownloadOptions = {
          type: 'npm',
          value: mockPackageName,
        }
        const download = new Download(options)

        await download.download()

        expect(mockRun).not.toHaveBeenCalled()
      })

      it('应该优雅处理package.json读取错误', async () => {
        mockReadJson.mockRejectedValue(new Error('File read error'))

        const options: DownloadOptions = {
          type: 'npm',
          value: mockPackageName,
        }
        const download = new Download(options)

        await expect(download.download()).rejects.toThrow('File read error')
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

      const options: DownloadOptions = {
        type: 'npm',
        value: `${mockPackageName}@${mockVersion}`,
        registry: 'https://registry.npmjs.org',
        cwd: mockCwd,
      }
      const download = new Download(options)

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
      expect(mockDownloadNpmTarball).toHaveBeenCalledWith(mockTarball)
      expect(mockReadJson).toHaveBeenCalledWith(
        path.join(mockDownloadPath, './package.json'),
      )
      expect(mockRun).toHaveBeenCalledWith('npm', ['install', '--production'], {
        cwd: mockDownloadPath,
      })
    })

    it('应该处理完整的git下载流程', async () => {
      const options: DownloadOptions = {
        type: 'git',
        value: mockGitUrl,
      }
      const download = new Download(options)

      const result = await download.download()

      expect(result).toBe(mockDownloadPath)
      expect(mockDownloadGitRepository).toHaveBeenCalledWith(mockGitUrl)
      expect(mockReadJson).toHaveBeenCalledWith(
        path.join(mockDownloadPath, './package.json'),
      )
    })

    it('应该处理无安装的npm下载', async () => {
      mockReadJson.mockResolvedValue({}) // No package.json

      const options: DownloadOptions = {
        type: 'npm',
        value: mockPackageName,
      }
      const download = new Download(options)

      const result = await download.download()

      expect(result).toBe(mockDownloadPath)
      expect(mockDownloadNpmTarball).toHaveBeenCalledWith(mockTarball)
      expect(mockRun).not.toHaveBeenCalled()
    })
  })

  describe('spinner 行为测试', () => {
    it('成功下载时应该按正确顺序调用spinner方法', async () => {
      const options: DownloadOptions = {
        type: 'npm',
        value: mockPackageName,
      }
      const download = new Download(options)

      await download.download()

      const startCalls = (mockSpinner.start as jest.Mock).mock.calls
      const succeedCalls = (mockSpinner.succeed as jest.Mock).mock.calls

      expect(startCalls.length).toBeGreaterThan(0)
      expect(succeedCalls.length).toBeGreaterThan(0)
      expect(mockSpinner.fail).not.toHaveBeenCalled()
    })

    it('下载失败时应该调用fail方法', async () => {
      mockDownloadNpmTarball.mockRejectedValue(new Error('Network error'))

      const options: DownloadOptions = {
        type: 'npm',
        value: mockPackageName,
      }
      const download = new Download(options)

      await expect(download.download()).rejects.toThrow()

      expect(mockSpinner.start).toHaveBeenCalled()
      expect(mockSpinner.fail).toHaveBeenCalled()
      expect(mockSpinner.succeed).not.toHaveBeenCalled()
    })

    it('git下载失败时应该调用fail方法', async () => {
      mockDownloadGitRepository.mockRejectedValue(new Error('Git error'))

      const options: DownloadOptions = {
        type: 'git',
        value: mockGitUrl,
      }
      const download = new Download(options)

      await expect(download.download()).rejects.toThrow()

      expect(mockSpinner.start).toHaveBeenCalled()
      expect(mockSpinner.fail).toHaveBeenCalled()
      expect(mockSpinner.succeed).not.toHaveBeenCalled()
    })
  })

  describe('属性和类型安全测试', () => {
    it('应该具有所有必需属性', () => {
      const options: DownloadOptions = {
        type: 'npm',
        value: mockPackageName,
      }

      const download = new Download(options)

      expect(download).toHaveProperty('constructorOptions')
      expect('_spinner' in download).toBe(true)
    })

    it('应该正确存储构造函数选项', () => {
      const options: DownloadOptions = {
        type: 'git',
        value: mockGitUrl,
        cwd: mockCwd,
      }

      const download = new Download(options)

      expect(download.constructorOptions.type).toBe('git')
      expect(download.constructorOptions.value).toBe(mockGitUrl)
      expect(download.constructorOptions.cwd).toBe(mockCwd)
    })

    it('应该接受有效的npm DownloadOptions', () => {
      const options: DownloadOptions = {
        type: 'npm',
        value: 'package-name',
        registry: 'https://registry.npmjs.org',
        cwd: '/some/path',
      }

      expect(() => new Download(options)).not.toThrow()
    })

    it('应该接受有效的git DownloadOptions', () => {
      const options: DownloadOptions = {
        type: 'git',
        value: 'https://github.com/user/repo.git',
      }

      expect(() => new Download(options)).not.toThrow()
    })

    it('应该扩展RemoteTemplate接口', () => {
      const remoteTemplate: RemoteTemplate = {
        type: 'npm',
        value: 'test-package',
      }

      const options: DownloadOptions = {
        ...remoteTemplate,
        cwd: '/test',
      }

      expect(() => new Download(options)).not.toThrow()
    })

    it('应该维护正确的属性类型', () => {
      const options: DownloadOptions = {
        type: 'npm',
        value: mockPackageName,
        cwd: mockCwd,
      }

      const download = new Download(options)

      expect(typeof download.constructorOptions.type).toBe('string')
      expect(typeof download.constructorOptions.value).toBe('string')
      expect(typeof download.constructorOptions.cwd).toBe('string')
    })

    it('应该有download方法', () => {
      const download = new Download({ type: 'npm', value: 'test' })
      expect(typeof download.download).toBe('function')
    })
  })

  describe('配置验证', () => {
    it('应该正确处理npm类型', () => {
      const options: DownloadOptions = {
        type: 'npm',
        value: 'my-package',
      }

      const download = new Download(options)

      expect(download.constructorOptions.type).toBe('npm')
    })

    it('应该正确处理git类型', () => {
      const options: DownloadOptions = {
        type: 'git',
        value: 'https://github.com/user/repo.git',
      }

      const download = new Download(options)

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
        const options: DownloadOptions = {
          type: 'npm',
          value: packageName,
        }

        expect(() => new Download(options)).not.toThrow()
        const download = new Download(options)
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
        const options: DownloadOptions = {
          type: 'git',
          value: gitUrl,
        }

        expect(() => new Download(options)).not.toThrow()
        const download = new Download(options)
        expect(download.constructorOptions.value).toBe(gitUrl)
      })
    })
  })

  describe('registry 处理测试', () => {
    it('应该为npm接受自定义registry', () => {
      const customRegistry = 'https://my-custom-registry.com'
      const options: DownloadOptions = {
        type: 'npm',
        value: 'test-package',
        registry: customRegistry,
      }

      const download = new Download(options)

      expect(download.constructorOptions.registry).toBe(customRegistry)
    })

    it('应该在没有registry的情况下工作', () => {
      const options: DownloadOptions = {
        type: 'npm',
        value: 'test-package',
      }

      const download = new Download(options)

      expect(download.constructorOptions.registry).toBeUndefined()
    })

    it('对于git类型应该忽略registry', () => {
      const options: DownloadOptions = {
        type: 'git',
        value: 'https://github.com/user/repo.git',
        registry: 'https://should-be-ignored.com',
      }

      const download = new Download(options)

      // Registry should still be there but not relevant for git
      expect(download.constructorOptions.registry).toBe(
        'https://should-be-ignored.com',
      )
    })
  })
})
