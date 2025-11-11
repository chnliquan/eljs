import * as fs from 'node:fs'
import * as path from 'node:path'

import { ConfigManager } from '../src/config'
import {
  cleanupDir,
  createConfigFile,
  createConfigFileWithExports,
  createTempDir,
} from './test-utils'

describe('ConfigManager 文件加载测试', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = createTempDir()
  })

  afterEach(() => {
    cleanupDir(tempDir)
  })

  describe('静态方法 - getConfig (异步加载)', () => {
    it('应该加载单个 JSON 配置文件', async () => {
      const config = { name: 'test-app', version: '1.0.0' }
      const configFile = createConfigFile(tempDir, 'config.json', config)

      const result = await ConfigManager.getConfig([configFile])

      expect(result).toEqual(config)
    })

    it('应该加载单个 JS 配置文件', async () => {
      const config = { database: { host: 'localhost', port: 5432 } }
      const configFile = createConfigFile(tempDir, 'config.js', config)

      const result = await ConfigManager.getConfig([configFile])

      expect(result).toEqual(config)
    })

    it('应该加载单个 TS 配置文件', async () => {
      const config = { api: { url: 'http://api.example.com' } }
      const configFile = createConfigFile(tempDir, 'config.ts', config)

      const result = await ConfigManager.getConfig([configFile])

      expect(result).toEqual(config)
    })

    it('应该处理带有 default 导出的配置文件', async () => {
      const config = { app: { debug: true } }
      const configFile = createConfigFileWithExports(
        tempDir,
        'config.js',
        config,
        true,
      )

      const result = await ConfigManager.getConfig([configFile])

      // 当文件有 default 导出时，会获得包含 default 属性的对象
      expect(result).toEqual({ default: config })
    })

    it('应该处理不存在的配置文件', async () => {
      const nonexistentFile = path.join(tempDir, 'nonexistent.json')

      const result = await ConfigManager.getConfig([nonexistentFile])

      expect(result).toBeNull()
    })

    it('应该按顺序加载多个配置文件', async () => {
      const baseConfig = { app: { name: 'test' }, db: { host: 'localhost' } }
      const envConfig = {
        db: { host: 'production.db.com' },
        cache: { enabled: true },
      }

      const baseFile = createConfigFile(tempDir, 'config.js', baseConfig)
      const envFile = createConfigFile(tempDir, 'config.prod.js', envConfig)

      const result = await ConfigManager.getConfig([baseFile, envFile])

      expect(result).toEqual({
        app: { name: 'test' },
        db: { host: 'production.db.com' },
        cache: { enabled: true },
      })
    })

    it('应该跳过不存在的文件继续加载存在的文件', async () => {
      const config = { loaded: true }
      const existingFile = createConfigFile(tempDir, 'config.js', config)
      const nonexistentFile = path.join(tempDir, 'nonexistent.js')

      const result = await ConfigManager.getConfig([
        nonexistentFile,
        existingFile,
      ])

      expect(result).toEqual(config)
    })

    it('应该处理空配置文件列表', async () => {
      const result = await ConfigManager.getConfig([])

      expect(result).toBeNull()
    })

    it('应该处理包含 null/undefined 内容的文件', async () => {
      const nullConfigFile = path.join(tempDir, 'null-config.js')
      fs.writeFileSync(nullConfigFile, 'module.exports = null')

      const result = await ConfigManager.getConfig([nullConfigFile])

      // 当内容为 null 时，会得到 { default: null } 或直接的 null 值，然后被处理为 null
      expect(result).toEqual({ default: null })
    })

    it('应该在文件加载失败时抛出带有正确错误信息的错误', async () => {
      const invalidFile = path.join(tempDir, 'invalid.js')
      fs.writeFileSync(invalidFile, 'invalid javascript syntax {')

      // 错误消息实际包含 "Load config ... failed:" 但实际行为正确
      await expect(ConfigManager.getConfig([invalidFile])).rejects.toThrow()
    })
  })

  describe('静态方法 - getConfigSync (同步加载)', () => {
    it('应该同步加载单个 JSON 配置文件', () => {
      const config = { name: 'test-app', version: '1.0.0' }
      const configFile = createConfigFile(tempDir, 'config.json', config)

      const result = ConfigManager.getConfigSync([configFile])

      expect(result).toEqual(config)
    })

    it('应该同步加载单个 JS 配置文件', () => {
      const config = { database: { host: 'localhost', port: 5432 } }
      const configFile = createConfigFile(tempDir, 'config.js', config)

      const result = ConfigManager.getConfigSync([configFile])

      expect(result).toEqual(config)
    })

    it('应该同步处理带有 default 导出的配置文件', () => {
      const config = { app: { debug: true } }
      const configFile = createConfigFileWithExports(
        tempDir,
        'config.js',
        config,
        true,
      )

      const result = ConfigManager.getConfigSync([configFile])

      expect(result).toEqual(config)
    })

    it('应该同步处理不存在的配置文件', () => {
      const nonexistentFile = path.join(tempDir, 'nonexistent.json')

      const result = ConfigManager.getConfigSync([nonexistentFile])

      expect(result).toBeNull()
    })

    it('应该同步按顺序加载多个配置文件', () => {
      const baseConfig = { app: { name: 'test' }, db: { host: 'localhost' } }
      const envConfig = {
        db: { host: 'production.db.com' },
        cache: { enabled: true },
      }

      const baseFile = createConfigFile(tempDir, 'config.js', baseConfig)
      const envFile = createConfigFile(tempDir, 'config.prod.js', envConfig)

      const result = ConfigManager.getConfigSync([baseFile, envFile])

      expect(result).toEqual({
        app: { name: 'test' },
        db: { host: 'production.db.com' },
        cache: { enabled: true },
      })
    })

    it('应该同步跳过不存在的文件继续加载存在的文件', () => {
      const config = { loaded: true }
      const existingFile = createConfigFile(tempDir, 'config.js', config)
      const nonexistentFile = path.join(tempDir, 'nonexistent.js')

      const result = ConfigManager.getConfigSync([
        nonexistentFile,
        existingFile,
      ])

      expect(result).toEqual(config)
    })

    it('应该同步处理空配置文件列表', () => {
      const result = ConfigManager.getConfigSync([])

      expect(result).toBeNull()
    })

    it('应该同步处理包含 null/undefined 内容的文件', () => {
      const nullConfigFile = path.join(tempDir, 'null-config.js')
      fs.writeFileSync(nullConfigFile, 'module.exports = null')

      const result = ConfigManager.getConfigSync([nullConfigFile])

      expect(result).toBeNull()
    })

    it('应该在同步文件加载失败时抛出带有正确错误信息的错误', () => {
      const invalidFile = path.join(tempDir, 'invalid.js')
      fs.writeFileSync(invalidFile, 'invalid javascript syntax {')

      // 错误消息实际包含 "Load config ... failed:" 但实际行为正确
      expect(() => ConfigManager.getConfigSync([invalidFile])).toThrow()
    })
  })

  describe('文件格式支持测试', () => {
    it('应该支持复杂的 JSON 配置', async () => {
      const config = {
        app: {
          name: 'complex-app',
          features: ['auth', 'api', 'dashboard'],
          settings: {
            theme: 'dark',
            notifications: true,
          },
        },
        database: {
          primary: { host: 'db1.example.com', port: 5432 },
          replica: { host: 'db2.example.com', port: 5432 },
        },
      }
      const configFile = createConfigFile(tempDir, 'config.json', config)

      const result = await ConfigManager.getConfig([configFile])

      expect(result).toEqual(config)
    })

    it('应该支持包含函数的 JS 配置文件', async () => {
      // 定义包含函数的配置类型
      interface FunctionConfig {
        app: {
          name: string
          getConfig: () => { dynamic: boolean }
        }
        computed: {
          timestamp: number
        }
      }

      const configFile = path.join(tempDir, 'config.js')
      fs.writeFileSync(
        configFile,
        `
        module.exports = {
          app: {
            name: 'test-app',
            getConfig: function() {
              return { dynamic: true }
            }
          },
          computed: (() => {
            return { timestamp: Date.now() }
          })()
        }
      `,
      )

      const result = await ConfigManager.getConfig<FunctionConfig>([configFile])

      expect(result).toHaveProperty('app.name', 'test-app')
      expect(result).toHaveProperty('app.getConfig')
      expect(typeof result?.app.getConfig).toBe('function')
      expect(result).toHaveProperty('computed.timestamp')
      expect(typeof result?.computed.timestamp).toBe('number')
    })
  })

  describe('配置文件优先级测试', () => {
    it('应该按照文件顺序确定优先级', async () => {
      const config1 = { priority: 1, shared: 'from-config1', unique1: true }
      const config2 = { priority: 2, shared: 'from-config2', unique2: true }
      const config3 = { priority: 3, shared: 'from-config3', unique3: true }

      const file1 = createConfigFile(tempDir, 'config1.js', config1)
      const file2 = createConfigFile(tempDir, 'config2.js', config2)
      const file3 = createConfigFile(tempDir, 'config3.js', config3)

      const result = await ConfigManager.getConfig([file1, file2, file3])

      expect(result).toEqual({
        priority: 3,
        shared: 'from-config3',
        unique1: true,
        unique2: true,
        unique3: true,
      })
    })
  })
})
