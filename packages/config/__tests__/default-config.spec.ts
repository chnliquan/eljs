/* eslint-disable @typescript-eslint/no-unused-vars */
import { ConfigManager } from '../src/config'
import { cleanupDir, createConfigFile, createTempDir } from './test-utils'

describe('ConfigManager DefaultConfig 功能测试', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = createTempDir('config-default-test-')
  })

  afterEach(() => {
    cleanupDir(tempDir)
  })

  describe('实例方法 - 带 defaultConfig 的 getConfig', () => {
    it('应该能使用默认配置并自动推断类型', async () => {
      // 定义默认配置，TypeScript 自动推断类型
      const defaultConfig = {
        app: {
          name: 'default-app',
          port: 3000,
          debug: false,
        },
        database: {
          host: 'localhost',
          port: 5432,
          ssl: false,
        },
        features: ['basic'] as string[],
      }

      // 创建部分配置文件
      const userConfig = {
        app: {
          name: 'my-app',
          port: 8080,
        },
        database: {
          host: 'custom-db.com',
          ssl: true,
        },
        features: ['auth', 'api'],
      }

      createConfigFile(tempDir, 'config.js', userConfig)

      const configManager = new ConfigManager({
        defaultConfigFiles: ['config.js'],
        cwd: tempDir,
      })

      // 使用默认配置，类型自动推断
      const result = await configManager.getConfig(defaultConfig)

      // 验证合并结果
      expect(result.app.name).toBe('my-app') // 来自用户配置
      expect(result.app.port).toBe(8080) // 来自用户配置
      expect(result.app.debug).toBe(false) // 来自默认配置
      expect(result.database.host).toBe('custom-db.com') // 来自用户配置
      expect(result.database.port).toBe(5432) // 来自默认配置
      expect(result.database.ssl).toBe(true) // 来自用户配置
      expect(result.features).toEqual(['basic', 'auth', 'api']) // 数组合并

      // TypeScript 类型推断验证
      expect(typeof result.app.name).toBe('string')
      expect(typeof result.app.port).toBe('number')
      expect(typeof result.app.debug).toBe('boolean')
      expect(Array.isArray(result.features)).toBe(true)
    })

    it('应该在没有配置文件时返回默认配置', async () => {
      const defaultConfig = {
        server: {
          host: 'localhost',
          port: 3000,
        },
        database: {
          url: 'postgresql://localhost:5432/default',
        },
      }

      const configManager = new ConfigManager({
        defaultConfigFiles: ['nonexistent.js'],
        cwd: tempDir,
      })

      const result = await configManager.getConfig(defaultConfig)

      // 应该返回完整的默认配置
      expect(result).toEqual(defaultConfig)
      expect(result.server.host).toBe('localhost')
      expect(result.server.port).toBe(3000)
      expect(result.database.url).toBe('postgresql://localhost:5432/default')
    })

    it('应该处理多环境配置与默认配置的合并', async () => {
      const defaultConfig = {
        app: {
          name: 'my-app',
          version: '1.0.0',
          debug: false,
        },
        server: {
          host: '127.0.0.1',
          port: 3000,
          ssl: false,
        },
        database: {
          type: 'postgresql' as const,
          host: 'localhost',
          port: 5432,
          pool: {
            min: 5,
            max: 20,
          },
        },
      }

      const baseConfig = {
        app: {
          version: '2.0.0',
        },
        server: {
          host: '0.0.0.0',
        },
      }

      const prodConfig = {
        app: {
          debug: false,
        },
        server: {
          port: 8080,
          ssl: true,
        },
        database: {
          host: 'prod-db.example.com',
          pool: {
            min: 10,
            max: 50,
          },
        },
      }

      createConfigFile(tempDir, 'config.js', baseConfig)
      createConfigFile(tempDir, 'config.prod.js', prodConfig)

      const configManager = new ConfigManager({
        defaultConfigFiles: ['config.js'],
        defaultConfigExts: ['prod'],
        cwd: tempDir,
      })

      const result = await configManager.getConfig(defaultConfig)

      expect(result).toEqual({
        app: {
          name: 'my-app', // 默认配置
          version: '2.0.0', // 基础配置覆盖
          debug: false, // 生产配置确认
        },
        server: {
          host: '0.0.0.0', // 基础配置覆盖
          port: 8080, // 生产配置覆盖
          ssl: true, // 生产配置覆盖
        },
        database: {
          type: 'postgresql', // 默认配置
          host: 'prod-db.example.com', // 生产配置覆盖
          port: 5432, // 默认配置
          pool: {
            min: 10, // 生产配置覆盖
            max: 50, // 生产配置覆盖
          },
        },
      })
    })
  })

  describe('实例方法 - 带 defaultConfig 的 getConfigSync', () => {
    it('应该同步使用默认配置并自动推断类型', () => {
      const defaultConfig = {
        api: {
          baseUrl: 'http://localhost:3000',
          timeout: 5000,
          retries: 3,
        },
        cache: {
          enabled: false,
          ttl: 3600,
        },
      }

      const userConfig = {
        api: {
          baseUrl: 'https://api.production.com',
          timeout: 10000,
        },
        cache: {
          enabled: true,
        },
      }

      createConfigFile(tempDir, 'config.js', userConfig)

      const configManager = new ConfigManager({
        defaultConfigFiles: ['config.js'],
        cwd: tempDir,
      })

      const result = configManager.getConfigSync(defaultConfig)

      expect(result.api.baseUrl).toBe('https://api.production.com')
      expect(result.api.timeout).toBe(10000)
      expect(result.api.retries).toBe(3) // 来自默认配置
      expect(result.cache.enabled).toBe(true) // 来自用户配置
      expect(result.cache.ttl).toBe(3600) // 来自默认配置
    })

    it('应该在没有配置文件时同步返回默认配置', () => {
      const defaultConfig = {
        build: {
          outDir: 'dist',
          sourceMap: true,
          minify: false,
        },
      }

      const configManager = new ConfigManager({
        defaultConfigFiles: ['build.config.js'],
        cwd: tempDir,
      })

      const result = configManager.getConfigSync(defaultConfig)

      expect(result).toEqual(defaultConfig)
    })
  })

  describe('静态方法 - 带 defaultConfig 的配置加载', () => {
    it('应该支持静态方法的默认配置', async () => {
      const defaultConfig = {
        env: 'development' as 'development' | 'production' | 'test',
        port: 3000,
        features: {
          auth: true,
          analytics: false,
        },
      }

      const envConfig = {
        env: 'production' as const,
        port: 8080,
        features: {
          analytics: true,
        },
      }

      const configFile = createConfigFile(tempDir, 'env.config.js', envConfig)

      const result = await ConfigManager.getConfig([configFile], defaultConfig)

      expect(result.env).toBe('production')
      expect(result.port).toBe(8080)
      expect(result.features.auth).toBe(true) // 默认配置保留
      expect(result.features.analytics).toBe(true) // 环境配置覆盖
    })

    it('应该支持同步静态方法的默认配置', () => {
      const defaultConfig = {
        theme: 'light' as 'light' | 'dark',
        language: 'en',
        notifications: {
          email: true,
          push: false,
          sms: false,
        },
      }

      const userPrefs = {
        theme: 'dark' as const,
        notifications: {
          push: true,
        },
      }

      const configFile = createConfigFile(tempDir, 'prefs.js', userPrefs)

      const result = ConfigManager.getConfigSync([configFile], defaultConfig)

      expect(result.theme).toBe('dark')
      expect(result.language).toBe('en') // 默认配置保留
      expect(result.notifications.email).toBe(true) // 默认配置保留
      expect(result.notifications.push).toBe(true) // 用户配置覆盖
      expect(result.notifications.sms).toBe(false) // 默认配置保留
    })

    it('应该在没有配置文件时返回默认配置', async () => {
      const defaultConfig = {
        server: { port: 3000 },
        database: { host: 'localhost' },
      }

      const nonexistentFile = 'nonexistent.js'

      const result = await ConfigManager.getConfig(
        [nonexistentFile],
        defaultConfig,
      )

      expect(result).toEqual(defaultConfig)
    })

    it('应该同步在没有配置文件时返回默认配置', () => {
      const defaultConfig = {
        test: { enabled: true },
        mock: { data: true },
      }

      const result = ConfigManager.getConfigSync(
        ['nonexistent.js'],
        defaultConfig,
      )

      expect(result).toEqual(defaultConfig)
    })
  })

  describe('类型推断验证', () => {
    it('应该正确推断复杂嵌套类型', async () => {
      const defaultConfig = {
        microservices: [
          {
            name: 'auth-service',
            port: 4001,
            enabled: true,
          },
        ] as Array<{
          name: string
          port: number
          enabled: boolean
        }>,
        monitoring: {
          metrics: ['cpu', 'memory'] as string[],
          alerts: {
            email: [] as string[],
            slack: [] as string[],
          },
        },
      }

      const prodConfig = {
        microservices: [
          {
            name: 'user-service',
            port: 4002,
            enabled: true,
          },
        ],
        monitoring: {
          alerts: {
            email: ['admin@example.com'],
            slack: ['#alerts'],
          },
        },
      }

      const configFile = createConfigFile(tempDir, 'services.js', prodConfig)

      const configManager = new ConfigManager({
        defaultConfigFiles: ['services.js'],
        cwd: tempDir,
      })

      const result = await configManager.getConfig(defaultConfig)

      // 验证数组合并
      expect(result.microservices).toHaveLength(2)
      expect(result.microservices[0].name).toBe('auth-service')
      expect(result.microservices[1].name).toBe('user-service')

      // 验证嵌套对象合并
      expect(result.monitoring.metrics).toEqual(['cpu', 'memory'])
      expect(result.monitoring.alerts.email).toEqual(['admin@example.com'])
      expect(result.monitoring.alerts.slack).toEqual(['#alerts'])
    })

    it('应该支持联合类型的推断', async () => {
      const defaultConfig = {
        database: {
          type: 'postgresql' as 'postgresql' | 'mysql' | 'sqlite',
          host: 'localhost',
          port: 5432,
          ssl: false,
        },
        logging: {
          level: 'info' as 'debug' | 'info' | 'warn' | 'error',
          outputs: ['console'] as Array<'console' | 'file' | 'syslog'>,
        },
      }

      const config = {
        database: {
          type: 'mysql' as const,
          host: 'mysql.example.com',
          port: 3306,
          ssl: true,
        },
        logging: {
          level: 'warn' as const,
          outputs: ['file', 'syslog'],
        },
      }

      const configFile = createConfigFile(tempDir, 'config.js', config)

      const result = await ConfigManager.getConfig([configFile], defaultConfig)

      expect(result.database.type).toBe('mysql')
      expect(result.database.host).toBe('mysql.example.com')
      expect(result.database.port).toBe(3306)
      expect(result.database.ssl).toBe(true)
      expect(result.logging.level).toBe('warn')
      expect(result.logging.outputs).toEqual(['console', 'file', 'syslog']) // 数组合并
    })
  })

  describe('API 一致性测试', () => {
    it('实例方法和静态方法应该产生相同结果', async () => {
      const defaultConfig = {
        api: { version: 'v1', timeout: 5000 },
        debug: false,
      }

      const userConfig = {
        api: { version: 'v2' },
        debug: true,
      }

      const configFile = createConfigFile(tempDir, 'config.js', userConfig)

      // 实例方法
      const configManager = new ConfigManager({
        defaultConfigFiles: ['config.js'],
        cwd: tempDir,
      })
      const instanceResult = await configManager.getConfig(defaultConfig)

      // 静态方法
      const staticResult = await ConfigManager.getConfig(
        [configFile],
        defaultConfig,
      )

      expect(instanceResult).toEqual(staticResult)
      expect(instanceResult.api.version).toBe('v2')
      expect(instanceResult.api.timeout).toBe(5000) // 默认配置保留
      expect(instanceResult.debug).toBe(true)
    })

    it('同步和异步方法应该产生相同结果', async () => {
      const defaultConfig = {
        build: {
          target: 'es2020',
          sourcemap: true,
          minify: false,
        },
      }

      const buildConfig = {
        build: {
          target: 'es2022',
          minify: true,
        },
      }

      const configFile = createConfigFile(tempDir, 'build.js', buildConfig)

      // 异步方法
      const asyncResult = await ConfigManager.getConfig(
        [configFile],
        defaultConfig,
      )

      // 同步方法
      const syncResult = ConfigManager.getConfigSync(
        [configFile],
        defaultConfig,
      )

      expect(asyncResult).toEqual(syncResult)
      expect(asyncResult.build.target).toBe('es2022')
      expect(asyncResult.build.sourcemap).toBe(true) // 默认配置保留
      expect(asyncResult.build.minify).toBe(true) // 用户配置覆盖
    })
  })

  describe('边界情况测试', () => {
    it('应该处理空的默认配置', async () => {
      const emptyDefault = {}
      const userConfig = { test: 'value' }

      const configFile = createConfigFile(tempDir, 'config.js', userConfig)

      const result = await ConfigManager.getConfig([configFile], emptyDefault)

      expect(result).toEqual(userConfig)
    })

    it('应该处理空的用户配置', async () => {
      const defaultConfig = {
        defaults: { loaded: true },
        values: [1, 2, 3],
      }

      const emptyConfigFile = createConfigFile(tempDir, 'empty.js', {})

      const result = await ConfigManager.getConfig(
        [emptyConfigFile],
        defaultConfig,
      )

      expect(result).toEqual(defaultConfig)
    })

    it('应该处理深度嵌套的默认配置', async () => {
      const defaultConfig = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  value: 'deep-default',
                  array: [1, 2, 3],
                  object: {
                    nested: true,
                  },
                },
              },
            },
          },
        },
      }

      const partialConfig = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  value: 'deep-override',
                },
              },
            },
          },
        },
      }

      const configFile = createConfigFile(tempDir, 'deep.js', partialConfig)

      const result = await ConfigManager.getConfig([configFile], defaultConfig)

      expect(result.level1.level2.level3.level4.level5.value).toBe(
        'deep-override',
      )
      expect(result.level1.level2.level3.level4.level5.array).toEqual([1, 2, 3]) // 保留默认值
      expect(result.level1.level2.level3.level4.level5.object.nested).toBe(true) // 保留默认值
    })
  })

  describe('类型安全验证', () => {
    it('TypeScript 应该能正确推断返回类型', async () => {
      const defaultConfig = {
        stringProp: 'string',
        numberProp: 42,
        booleanProp: true,
        arrayProp: [1, 2, 3],
        objectProp: {
          nested: 'value',
        },
        unionProp: 'option1' as 'option1' | 'option2' | 'option3',
      }

      const configManager = new ConfigManager({
        defaultConfigFiles: ['nonexistent.js'],
        cwd: tempDir,
      })

      const result = await configManager.getConfig(defaultConfig)

      // TypeScript 应该能正确推断这些类型
      expect(typeof result.stringProp).toBe('string')
      expect(typeof result.numberProp).toBe('number')
      expect(typeof result.booleanProp).toBe('boolean')
      expect(Array.isArray(result.arrayProp)).toBe(true)
      expect(typeof result.objectProp).toBe('object')
      expect(result.unionProp).toBe('option1')
    })
  })
})
