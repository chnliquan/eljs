/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * @file packages/release runner 模块单元测试
 * @description 测试 Runner 类的核心功能
 */

import { Runner } from '../src/runner'
import type { Config } from '../src/types'

// 模拟所有依赖
jest.mock('@eljs/pluggable')
jest.mock('@eljs/utils')
jest.mock('../src/default')
jest.mock('../src/utils')

// 模拟 console.log
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {})

describe('Runner 类测试', () => {
  afterAll(() => {
    mockConsoleLog.mockRestore()
  })

  beforeEach(() => {
    jest.clearAllMocks()

    // 重新设置基本的模拟
    const { isPathExistsSync, readJsonSync, logger } = require('@eljs/utils')
    isPathExistsSync.mockReturnValue(true)
    readJsonSync.mockReturnValue({ name: 'it-package', version: '1.0.0' })
    logger.error = jest.fn()
    logger.step = jest.fn()
  })

  describe('Runner 构造函数', () => {
    it('应该成功创建 Runner 实例', () => {
      const runner = new Runner()

      expect(runner).toBeInstanceOf(Runner)
      expect(runner.appData).toBeDefined()
    })

    it('应该使用指定的工作目录', () => {
      const cwd = '/custom/path'
      const runner = new Runner({ cwd })

      expect(runner).toBeInstanceOf(Runner)
    })

    it('应该正确验证 package.json 路径', () => {
      const { isPathExistsSync } = require('@eljs/utils')
      const itPath = '/it/project'

      new Runner({ cwd: itPath })

      expect(isPathExistsSync).toHaveBeenCalledWith('/it/project/package.json')
    })

    it('当 package.json 不存在时应该抛出 AppError', () => {
      const { isPathExistsSync } = require('@eljs/utils')
      isPathExistsSync.mockReturnValue(false)

      expect(() => new Runner()).toThrow()
    })

    it('当 package.json 没有 version 字段时应该抛出 AppError', () => {
      const { readJsonSync } = require('@eljs/utils')
      readJsonSync.mockReturnValue({ name: 'it' })

      expect(() => new Runner()).toThrow()
    })

    it('应该正确设置 appData', () => {
      const mockPkg = { name: 'it-package', version: '2.0.0' }
      const { readJsonSync } = require('@eljs/utils')
      readJsonSync.mockReturnValue(mockPkg)

      const runner = new Runner({ cwd: '/it/path' })

      expect(runner.appData.projectPkg).toEqual(mockPkg)
      expect(runner.appData.projectPkgJsonPath).toBe('/it/path/package.json')
    })

    it('应该正确传递配置到 Pluggable', () => {
      const { Pluggable } = require('@eljs/pluggable')
      const config: Config = {
        cwd: '/it',
        presets: ['preset1'],
        plugins: ['plugin1'],
      }

      new Runner(config)

      expect(Pluggable).toHaveBeenCalledWith(
        expect.objectContaining({
          cwd: '/it',
          presets: [expect.stringMatching(/internal/), 'preset1'],
          plugins: ['plugin1'],
          defaultConfigFiles: ['release.config.ts', 'release.config.js'],
        }),
      )
    })

    it('应该正确处理默认值', () => {
      const { Pluggable } = require('@eljs/pluggable')

      new Runner()

      expect(Pluggable).toHaveBeenCalledWith(
        expect.objectContaining({
          cwd: expect.any(String),
          presets: [expect.stringMatching(/internal/)],
          plugins: [],
        }),
      )
    })

    it('应该验证 version 字段的有效性', () => {
      const { readJsonSync } = require('@eljs/utils')
      const validVersions = ['1.0.0', '0.1.0', '10.20.30', '1.0.0-alpha.1']

      validVersions.forEach(version => {
        readJsonSync.mockReturnValue({ name: 'it', version })
        expect(() => new Runner()).not.toThrow()
      })
    })

    it('应该拒绝无效的 version 字段', () => {
      const { readJsonSync } = require('@eljs/utils')
      const invalidVersions = [null, undefined, '', false, 0]

      invalidVersions.forEach(version => {
        readJsonSync.mockReturnValue({ name: 'it', version })
        expect(() => new Runner()).toThrow()
      })
    })
  })

  describe('Runner step 方法', () => {
    it('应该调用 logger.step 方法', () => {
      const { logger } = require('@eljs/utils')
      const runner = new Runner()
      const message = '测试步骤'

      runner.step(message)

      expect(logger.step).toHaveBeenCalledWith('Release', `${message}\n`)
    })

    it('应该正确格式化不同类型的消息', () => {
      const { logger } = require('@eljs/utils')
      const runner = new Runner()

      runner.step('开始发布')
      runner.step('版本检查完成')
      runner.step('发布成功')

      expect(logger.step).toHaveBeenCalledTimes(3)
      expect(logger.step).toHaveBeenNthCalledWith(1, 'Release', '开始发布\n')
      expect(logger.step).toHaveBeenNthCalledWith(
        2,
        'Release',
        '版本检查完成\n',
      )
      expect(logger.step).toHaveBeenNthCalledWith(3, 'Release', '发布成功\n')
    })

    it('应该处理空消息', () => {
      const { logger } = require('@eljs/utils')
      const runner = new Runner()

      runner.step('')

      expect(logger.step).toHaveBeenCalledWith('Release', '\n')
    })

    it('应该处理特殊字符', () => {
      const { logger } = require('@eljs/utils')
      const runner = new Runner()
      const message = '发布 v1.0.0 🚀'

      runner.step(message)

      expect(logger.step).toHaveBeenCalledWith('Release', `${message}\n`)
    })

    it('应该正确添加换行符', () => {
      const { logger } = require('@eljs/utils')
      const runner = new Runner()

      runner.step('it')

      expect(logger.step).toHaveBeenCalledWith(
        'Release',
        expect.stringMatching(/\n$/),
      )
    })

    it('应该处理长消息', () => {
      const { logger } = require('@eljs/utils')
      const runner = new Runner()
      const longMessage = 'x'.repeat(1000)

      runner.step(longMessage)

      expect(logger.step).toHaveBeenCalledWith('Release', `${longMessage}\n`)
    })
  })

  describe('Runner run 方法基础测试', () => {
    it('run 方法应该存在', () => {
      const runner = new Runner()
      expect(typeof runner.run).toBe('function')
    })

    it('run 方法应该是异步的', () => {
      const runner = new Runner()
      // 由于模拟环境的限制，检查函数是否返回 Promise 即可
      const result = runner.run()
      expect(result).toBeInstanceOf(Promise)
      result.catch(() => {}) // 避免未处理的 rejection
    })

    it('run 方法应该接受不同参数类型', () => {
      const runner = new Runner()

      expect(() => {
        runner.run('patch').catch(() => {})
        runner.run('1.0.0').catch(() => {})
        runner.run().catch(() => {})
      }).not.toThrow()
    })
  })

  describe('Runner 错误处理', () => {
    it('应该处理文件系统访问错误', () => {
      const { isPathExistsSync } = require('@eljs/utils')
      isPathExistsSync.mockImplementation(() => {
        throw new Error('Permission denied')
      })

      expect(() => new Runner()).toThrow()
    })

    it('应该处理 JSON 解析错误', () => {
      const { readJsonSync } = require('@eljs/utils')
      readJsonSync.mockImplementation(() => {
        throw new SyntaxError('Malformed JSON')
      })

      expect(() => new Runner()).toThrow()
    })

    it('应该正确使用 chalk 来格式化错误消息', () => {
      const { isPathExistsSync, chalk } = require('@eljs/utils')
      isPathExistsSync.mockReturnValue(false)
      chalk.cyan.mockReturnValue('[styled-path]')

      expect(() => new Runner({ cwd: '/it' })).toThrow()
      expect(chalk.cyan).toHaveBeenCalledWith('/it')
    })
  })

  describe('Runner 配置验证和处理', () => {
    it('应该接受各种配置组合', () => {
      const configs = [
        {},
        { cwd: '/it' },
        { presets: ['preset1'] },
        { plugins: ['plugin1'] },
        { git: { requireClean: false } },
        { npm: { confirm: false } },
        { github: { release: false } },
      ]

      configs.forEach(config => {
        expect(() => new Runner(config)).not.toThrow()
      })
    })

    it('应该正确处理 presets 数组', () => {
      const { Pluggable } = require('@eljs/pluggable')

      // 空数组
      new Runner({ presets: [] })
      expect(Pluggable).toHaveBeenLastCalledWith(
        expect.objectContaining({
          presets: [expect.stringMatching(/internal/)],
        }),
      )

      // 单个 preset
      new Runner({ presets: ['single-preset'] })
      expect(Pluggable).toHaveBeenLastCalledWith(
        expect.objectContaining({
          presets: [expect.stringMatching(/internal/), 'single-preset'],
        }),
      )

      // 多个 presets
      new Runner({ presets: ['preset1', 'preset2', 'preset3'] })
      expect(Pluggable).toHaveBeenLastCalledWith(
        expect.objectContaining({
          presets: [
            expect.stringMatching(/internal/),
            'preset1',
            'preset2',
            'preset3',
          ],
        }),
      )
    })

    it('应该正确处理 plugins 数组', () => {
      const { Pluggable } = require('@eljs/pluggable')

      // 空数组
      new Runner({ plugins: [] })
      expect(Pluggable).toHaveBeenLastCalledWith(
        expect.objectContaining({
          plugins: [],
        }),
      )

      // 多个 plugins
      new Runner({ plugins: ['plugin1', 'plugin2'] })
      expect(Pluggable).toHaveBeenLastCalledWith(
        expect.objectContaining({
          plugins: ['plugin1', 'plugin2'],
        }),
      )
    })
  })

  describe('Runner 属性和方法验证', () => {
    it('应该有所有必需的公共属性', () => {
      const runner = new Runner()

      expect(runner).toHaveProperty('appData')
      expect(typeof runner.appData).toBe('object')
      // config 属性在初始化后可能不存在
      expect(
        'config' in Object.getOwnPropertyDescriptors(runner) ||
          runner.config === undefined,
      ).toBe(true)
    })

    it('应该有所有必需的公共方法', () => {
      const runner = new Runner()

      expect(typeof runner.step).toBe('function')
      expect(typeof runner.run).toBe('function')
      expect(typeof runner.applyPlugins).toBe('function')
    })

    it('appData 应该有正确的初始结构', () => {
      const runner = new Runner()

      expect(runner.appData).toHaveProperty('projectPkgJsonPath')
      expect(runner.appData).toHaveProperty('projectPkg')
      expect(typeof runner.appData.projectPkgJsonPath).toBe('string')
      expect(runner.appData.projectPkg).toBeTruthy()
    })
  })

  describe('Runner 边界条件测试', () => {
    it('应该处理各种路径格式', () => {
      const paths = [
        '/absolute/path',
        './relative/path',
        '../parent/path',
        '/path with spaces',
        '/path/with/unicode/测试',
      ]

      paths.forEach(path => {
        expect(() => new Runner({ cwd: path })).not.toThrow()
      })
    })

    it('应该处理特殊的 package.json 内容', () => {
      const { readJsonSync } = require('@eljs/utils')
      const specialPackages = [
        { name: 'normal-package', version: '1.0.0' },
        { name: '@scoped/package', version: '2.1.3' },
        { name: '测试包', version: '1.0.0' },
        { name: 'package-with-emoji-🚀', version: '1.0.0' },
        {
          name: 'complex-package',
          version: '1.0.0-beta.1',
          description: 'A complex package with many fields',
          keywords: ['it', 'complex'],
        },
      ]

      specialPackages.forEach(pkg => {
        readJsonSync.mockReturnValue(pkg)
        const runner = new Runner()
        expect(runner.appData.projectPkg).toEqual(pkg)
      })
    })

    it('应该处理大型配置对象', () => {
      const largeConfig: Config = {
        presets: Array.from({ length: 50 }, (_, i) => `preset-${i}`),
        plugins: Array.from({ length: 50 }, (_, i) => `plugin-${i}`),
        git: {
          requireClean: true,
          changelog: {
            filename: 'CHANGELOG.md',
            preset: 'angular',
          },
        },
        npm: {
          confirm: true,
          publishArgs: ['--access', 'public'],
        },
      }

      expect(() => new Runner(largeConfig)).not.toThrow()
    })
  })
})
