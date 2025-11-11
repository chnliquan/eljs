/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as path from 'node:path'

import { ConfigManager, type ConfigManagerOptions } from '../src'
import { cleanupDir, createConfigFile, createTempDir } from './test-utils'

describe('ConfigManager 基础功能测试', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = createTempDir('config-basic-test-')
  })

  afterEach(() => {
    cleanupDir(tempDir)
  })

  describe('构造函数和初始化', () => {
    it('应该正确初始化 ConfigManager 实例', () => {
      const options: ConfigManagerOptions = {
        defaultConfigFiles: ['config.ts', 'config.js'],
        defaultConfigExts: ['dev', 'prod'],
        cwd: tempDir,
      }

      const configManager = new ConfigManager(options)

      expect(configManager.constructorOptions).toEqual(options)
      expect(configManager.mainConfigFile).toBeUndefined()
    })

    it('应该处理最小配置选项', () => {
      const options: ConfigManagerOptions = {
        defaultConfigFiles: ['config.ts'],
      }

      const configManager = new ConfigManager(options)

      expect(configManager.constructorOptions.defaultConfigFiles).toEqual([
        'config.ts',
      ])
      expect(configManager.constructorOptions.defaultConfigExts).toBeUndefined()
      expect(configManager.constructorOptions.cwd).toBeUndefined()
    })

    it('应该保存配置选项的引用', () => {
      const options: ConfigManagerOptions = {
        defaultConfigFiles: ['config.ts', 'config.js'],
        defaultConfigExts: ['dev', 'staging'],
        cwd: '/custom/path',
      }

      const configManager = new ConfigManager(options)

      expect(configManager.constructorOptions).toBe(options)
    })
  })

  describe('静态方法 - getMainConfigFile', () => {
    it('应该找到第一个存在的配置文件', async () => {
      // 创建测试文件
      createConfigFile(tempDir, 'config.js', { test: true })
      createConfigFile(tempDir, 'config.json', { test: true })

      const configFiles = ['config.ts', 'config.js', 'config.json']
      const result = await ConfigManager.getMainConfigFile(configFiles, tempDir)

      expect(result).toBe(path.join(tempDir, 'config.js'))
    })

    it('应该在没有找到配置文件时返回 undefined', async () => {
      const configFiles = ['config.ts', 'config.js', 'config.json']
      const result = await ConfigManager.getMainConfigFile(configFiles, tempDir)

      expect(result).toBeUndefined()
    })

    it('应该按照顺序查找配置文件', async () => {
      // 创建多个配置文件
      createConfigFile(tempDir, 'config.json', { test: true })
      createConfigFile(tempDir, 'config.ts', { test: true })

      const configFiles = ['config.ts', 'config.js', 'config.json']
      const result = await ConfigManager.getMainConfigFile(configFiles, tempDir)

      expect(result).toBe(path.join(tempDir, 'config.ts'))
    })

    it('应该使用默认的 cwd', async () => {
      const originalCwd = process.cwd()

      try {
        // 改变当前工作目录到临时目录
        process.chdir(tempDir)
        createConfigFile(tempDir, 'config.js', { test: true })

        const configFiles = ['config.js']
        const result = await ConfigManager.getMainConfigFile(configFiles)

        expect(result).toContain('config.js')
        expect(path.basename(result!)).toBe('config.js')
      } finally {
        process.chdir(originalCwd)
      }
    })
  })

  describe('静态方法 - getMainConfigFileSync', () => {
    it('应该同步找到第一个存在的配置文件', () => {
      createConfigFile(tempDir, 'config.js', { test: true })
      createConfigFile(tempDir, 'config.json', { test: true })

      const configFiles = ['config.ts', 'config.js', 'config.json']
      const result = ConfigManager.getMainConfigFileSync(configFiles, tempDir)

      expect(result).toBe(path.join(tempDir, 'config.js'))
    })

    it('应该在没有找到配置文件时返回 undefined', () => {
      const configFiles = ['config.ts', 'config.js', 'config.json']
      const result = ConfigManager.getMainConfigFileSync(configFiles, tempDir)

      expect(result).toBeUndefined()
    })

    it('应该按照顺序查找配置文件', () => {
      createConfigFile(tempDir, 'config.json', { test: true })
      createConfigFile(tempDir, 'config.ts', { test: true })

      const configFiles = ['config.ts', 'config.js', 'config.json']
      const result = ConfigManager.getMainConfigFileSync(configFiles, tempDir)

      expect(result).toBe(path.join(tempDir, 'config.ts'))
    })

    it('应该使用默认的 cwd', () => {
      const originalCwd = process.cwd()

      try {
        process.chdir(tempDir)
        createConfigFile(tempDir, 'config.js', { test: true })

        const configFiles = ['config.js']
        const result = ConfigManager.getMainConfigFileSync(configFiles)

        expect(result).toContain('config.js')
        expect(path.basename(result!)).toBe('config.js')
      } finally {
        process.chdir(originalCwd)
      }
    })
  })

  describe('静态方法 - getConfigFiles', () => {
    it('应该生成正确的配置文件列表', () => {
      const mainConfigFile = '/path/to/config.ts'
      const configExts = ['dev', 'prod', 'staging']

      const result = ConfigManager.getConfigFiles(mainConfigFile, configExts)

      expect(result).toEqual([
        '/path/to/config.ts',
        '/path/to/config.dev.ts',
        '/path/to/config.prod.ts',
        '/path/to/config.staging.ts',
      ])
    })

    it('应该处理空扩展名列表', () => {
      const mainConfigFile = '/path/to/config.ts'
      const configExts: string[] = []

      const result = ConfigManager.getConfigFiles(mainConfigFile, configExts)

      expect(result).toEqual(['/path/to/config.ts'])
    })

    it('应该处理不同文件扩展名', () => {
      const mainConfigFile = '/path/to/config.js'
      const configExts = ['dev', 'prod']

      const result = ConfigManager.getConfigFiles(mainConfigFile, configExts)

      expect(result).toEqual([
        '/path/to/config.js',
        '/path/to/config.dev.js',
        '/path/to/config.prod.js',
      ])
    })

    it('应该处理复杂的文件路径', () => {
      const mainConfigFile = '/complex/nested/path/app.config.ts'
      const configExts = ['local']

      const result = ConfigManager.getConfigFiles(mainConfigFile, configExts)

      expect(result).toEqual([
        '/complex/nested/path/app.config.ts',
        '/complex/nested/path/app.config.local.ts',
      ])
    })
  })

  describe('实例方法 - getConfig', () => {
    it('应该在没有配置文件时返回 null', async () => {
      const configManager = new ConfigManager({
        defaultConfigFiles: ['nonexistent.ts'],
        cwd: tempDir,
      })

      const result = await configManager.getConfig()

      expect(result).toBeNull()
    })

    it('应该加载单个配置文件', async () => {
      const config = { database: { host: 'localhost', port: 5432 } }
      createConfigFile(tempDir, 'config.js', config)

      const configManager = new ConfigManager({
        defaultConfigFiles: ['config.js'],
        cwd: tempDir,
      })

      const result = await configManager.getConfig()

      expect(result).toEqual(config)
    })

    it('应该处理没有扩展配置的情况', async () => {
      const config = { app: { name: 'test' } }
      createConfigFile(tempDir, 'config.js', config)

      const configManager = new ConfigManager({
        defaultConfigFiles: ['config.js'],
        cwd: tempDir,
      })

      const result = await configManager.getConfig()

      expect(result).toEqual(config)
    })

    it('应该加载带有扩展配置的文件', async () => {
      const baseConfig = { app: { name: 'test', port: 3000 } }
      const devConfig = { app: { debug: true } }

      createConfigFile(tempDir, 'config.js', baseConfig)
      createConfigFile(tempDir, 'config.dev.js', devConfig)

      const configManager = new ConfigManager({
        defaultConfigFiles: ['config.js'],
        defaultConfigExts: ['dev'],
        cwd: tempDir,
      })

      const result = await configManager.getConfig()

      expect(result).toEqual({
        app: {
          name: 'test',
          port: 3000,
          debug: true,
        },
      })
    })
  })

  describe('实例方法 - getConfigSync', () => {
    it('应该在没有配置文件时返回 null', () => {
      const configManager = new ConfigManager({
        defaultConfigFiles: ['nonexistent.ts'],
        cwd: tempDir,
      })

      const result = configManager.getConfigSync()

      expect(result).toBeNull()
    })

    it('应该同步加载单个配置文件', () => {
      const config = { database: { host: 'localhost', port: 5432 } }
      createConfigFile(tempDir, 'config.js', config)

      const configManager = new ConfigManager({
        defaultConfigFiles: ['config.js'],
        cwd: tempDir,
      })

      const result = configManager.getConfigSync()

      expect(result).toEqual(config)
    })

    it('应该同步处理没有扩展配置的情况', () => {
      const config = { app: { name: 'test' } }
      createConfigFile(tempDir, 'config.js', config)

      const configManager = new ConfigManager({
        defaultConfigFiles: ['config.js'],
        cwd: tempDir,
      })

      const result = configManager.getConfigSync()

      expect(result).toEqual(config)
    })

    it('应该同步加载带有扩展配置的文件', () => {
      const baseConfig = { app: { name: 'test', port: 3000 } }
      const devConfig = { app: { debug: true } }

      createConfigFile(tempDir, 'config.js', baseConfig)
      createConfigFile(tempDir, 'config.dev.js', devConfig)

      const configManager = new ConfigManager({
        defaultConfigFiles: ['config.js'],
        defaultConfigExts: ['dev'],
        cwd: tempDir,
      })

      const result = configManager.getConfigSync()

      expect(result).toEqual({
        app: {
          name: 'test',
          port: 3000,
          debug: true,
        },
      })
    })
  })
})
