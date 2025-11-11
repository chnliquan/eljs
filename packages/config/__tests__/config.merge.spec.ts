/* eslint-disable @typescript-eslint/no-unused-vars */
import { ConfigManager } from '../src/config'
import {
  cleanupDir,
  createConfigFile,
  createJSConfigFile,
  createTempDir,
} from './test-utils'

describe('ConfigManager 配置合并测试', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = createTempDir('config-merge-test-')
  })

  afterEach(() => {
    cleanupDir(tempDir)
  })

  describe('基础配置合并', () => {
    it('应该深度合并两个简单配置对象', async () => {
      const baseConfig = {
        app: {
          name: 'my-app',
          port: 3000,
        },
        database: {
          host: 'localhost',
        },
      }

      const envConfig = {
        app: {
          port: 8080,
          debug: true,
        },
        cache: {
          enabled: true,
        },
      }

      const baseFile = createConfigFile(tempDir, 'config.js', baseConfig)
      const envFile = createConfigFile(tempDir, 'config.dev.js', envConfig)

      const result = await ConfigManager.getConfig([baseFile, envFile])

      expect(result).toEqual({
        app: {
          name: 'my-app',
          port: 8080,
          debug: true,
        },
        database: {
          host: 'localhost',
        },
        cache: {
          enabled: true,
        },
      })
    })

    it('应该正确处理数组的合并（数组会被合并而非替换）', async () => {
      const baseConfig = {
        features: ['auth', 'api'],
        middleware: ['cors', 'body-parser'],
      }

      const envConfig = {
        features: ['dashboard', 'analytics'],
        middleware: ['helmet'],
      }

      const baseFile = createConfigFile(tempDir, 'config.js', baseConfig)
      const envFile = createConfigFile(tempDir, 'config.prod.js', envConfig)

      const result = await ConfigManager.getConfig([baseFile, envFile])

      // deepMerge 的默认行为是合并数组而不是替换
      expect(result).toEqual({
        features: ['auth', 'api', 'dashboard', 'analytics'],
        middleware: ['cors', 'body-parser', 'helmet'],
      })
    })

    it('应该处理基本数据类型的覆盖', async () => {
      const baseConfig = {
        app: {
          name: 'my-app',
          version: '1.0.0',
          debug: false,
          port: 3000,
        },
      }

      const envConfig = {
        app: {
          version: '2.0.0',
          debug: true,
          port: 8080,
        },
      }

      const baseFile = createConfigFile(tempDir, 'config.js', baseConfig)
      const envFile = createConfigFile(tempDir, 'config.dev.js', envConfig)

      const result = await ConfigManager.getConfig([baseFile, envFile])

      expect(result).toEqual({
        app: {
          name: 'my-app',
          version: '2.0.0',
          debug: true,
          port: 8080,
        },
      })
    })
  })

  describe('复杂配置合并', () => {
    it('应该处理多层嵌套对象的合并', async () => {
      const baseConfig = {
        services: {
          auth: {
            provider: 'local',
            options: {
              saltRounds: 10,
              tokenExpiry: '1h',
            },
          },
          database: {
            main: {
              host: 'localhost',
              port: 5432,
            },
          },
        },
      }

      const envConfig = {
        services: {
          auth: {
            provider: 'oauth',
            options: {
              clientId: 'abc123',
              saltRounds: 12,
            },
          },
          database: {
            main: {
              host: 'prod-db.example.com',
            },
            cache: {
              host: 'redis.example.com',
              port: 6379,
            },
          },
        },
      }

      const baseFile = createConfigFile(tempDir, 'config.js', baseConfig)
      const envFile = createConfigFile(tempDir, 'config.prod.js', envConfig)

      const result = await ConfigManager.getConfig([baseFile, envFile])

      expect(result).toEqual({
        services: {
          auth: {
            provider: 'oauth',
            options: {
              saltRounds: 12,
              tokenExpiry: '1h',
              clientId: 'abc123',
            },
          },
          database: {
            main: {
              host: 'prod-db.example.com',
              port: 5432,
            },
            cache: {
              host: 'redis.example.com',
              port: 6379,
            },
          },
        },
      })
    })

    it('应该按顺序合并多个配置文件', async () => {
      const baseConfig = {
        level: 'base',
        value: 1,
        base: true,
      }

      const envConfig = {
        level: 'env',
        value: 2,
        env: true,
      }

      const localConfig = {
        level: 'local',
        value: 3,
        local: true,
      }

      const baseFile = createConfigFile(tempDir, 'config.js', baseConfig)
      const envFile = createConfigFile(tempDir, 'config.env.js', envConfig)
      const localFile = createConfigFile(
        tempDir,
        'config.local.js',
        localConfig,
      )

      const result = await ConfigManager.getConfig([
        baseFile,
        envFile,
        localFile,
      ])

      expect(result).toEqual({
        level: 'local',
        value: 3,
        base: true,
        env: true,
        local: true,
      })
    })
  })

  describe('特殊值处理', () => {
    it('应该正确处理 null 值的覆盖', async () => {
      const baseConfig = {
        feature: {
          enabled: true,
          config: {
            setting1: 'value1',
            setting2: 'value2',
          },
        },
      }

      const envConfig = {
        feature: {
          config: null,
        },
      }

      const baseFile = createConfigFile(tempDir, 'config.js', baseConfig)
      const envFile = createConfigFile(tempDir, 'config.test.js', envConfig)

      const result = await ConfigManager.getConfig([baseFile, envFile])

      expect(result).toEqual({
        feature: {
          enabled: true,
          config: null,
        },
      })
    })

    it('应该正确处理 undefined 值', async () => {
      const baseConfig = {
        app: {
          name: 'test-app',
          description: 'A test application',
        },
      }

      // 创建包含 undefined 的配置文件
      const envFile = createJSConfigFile(
        tempDir,
        'config.env.js',
        `
        module.exports = {
          app: {
            description: undefined
          }
        }
      `,
      )

      const baseFile = createConfigFile(tempDir, 'config.js', baseConfig)

      const result = await ConfigManager.getConfig([baseFile, envFile])

      expect(result).toEqual({
        app: {
          name: 'test-app',
          description: undefined,
        },
      })
    })

    it('应该正确处理空对象的合并', async () => {
      const baseConfig = {
        app: {
          name: 'test-app',
        },
        empty: {},
      }

      const envConfig = {
        app: {},
        empty: {
          filled: true,
        },
      }

      const baseFile = createConfigFile(tempDir, 'config.js', baseConfig)
      const envFile = createConfigFile(tempDir, 'config.env.js', envConfig)

      const result = await ConfigManager.getConfig([baseFile, envFile])

      expect(result).toEqual({
        app: {
          name: 'test-app',
        },
        empty: {
          filled: true,
        },
      })
    })
  })

  describe('实际使用场景', () => {
    it('应该同步处理多环境配置合并', () => {
      const baseConfig = {
        api: {
          baseUrl: 'http://localhost:3000',
          timeout: 5000,
          retries: 3,
        },
        features: {
          auth: true,
          payments: false,
        },
      }

      const devConfig = {
        api: {
          baseUrl: 'http://dev-api.example.com',
          debug: true,
        },
        features: {
          payments: true,
          devTools: true,
        },
      }

      const baseFile = createConfigFile(tempDir, 'config.js', baseConfig)
      const devFile = createConfigFile(tempDir, 'config.dev.js', devConfig)

      const configManager = new ConfigManager({
        defaultConfigFiles: ['config.js'],
        defaultConfigExts: ['dev'],
        cwd: tempDir,
      })

      const result = configManager.getConfigSync()

      expect(result).toEqual({
        api: {
          baseUrl: 'http://dev-api.example.com',
          timeout: 5000,
          retries: 3,
          debug: true,
        },
        features: {
          auth: true,
          payments: true,
          devTools: true,
        },
      })
    })
  })

  describe('边界情况处理', () => {
    it('应该处理只有扩展配置文件的情况', async () => {
      const devConfig = {
        app: {
          debug: true,
        },
      }

      createConfigFile(tempDir, 'config.dev.js', devConfig)

      const configManager = new ConfigManager({
        defaultConfigFiles: ['config.js'],
        defaultConfigExts: ['dev'],
        cwd: tempDir,
      })

      const result = await configManager.getConfig()

      expect(result).toBeNull()
    })

    it('应该处理扩展配置文件不存在的情况', async () => {
      const baseConfig = {
        app: {
          name: 'test',
        },
      }

      createConfigFile(tempDir, 'config.js', baseConfig)

      const configManager = new ConfigManager({
        defaultConfigFiles: ['config.js'],
        defaultConfigExts: ['nonexistent'],
        cwd: tempDir,
      })

      const result = await configManager.getConfig()

      expect(result).toEqual(baseConfig)
    })
  })
})
