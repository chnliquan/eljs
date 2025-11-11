import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { ConfigManager } from '../src/config'

// 测试工具函数
const createTempDir = () => {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'config-async-test-'))
}

const createConfigFile = (
  dir: string,
  filename: string,
  content: object | string,
) => {
  const filePath = path.join(dir, filename)

  if (typeof content === 'string') {
    fs.writeFileSync(filePath, content)
  } else if (filename.endsWith('.json')) {
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2))
  } else if (filename.endsWith('.js')) {
    fs.writeFileSync(
      filePath,
      `module.exports = ${JSON.stringify(content, null, 2)}`,
    )
  } else if (filename.endsWith('.ts')) {
    fs.writeFileSync(
      filePath,
      `export default ${JSON.stringify(content, null, 2)}`,
    )
  }

  return filePath
}

const cleanupDir = (dir: string) => {
  try {
    fs.rmSync(dir, { recursive: true, force: true })
  } catch {
    // 忽略清理错误
  }
}

describe('ConfigManager 同步异步 API 对比测试', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = createTempDir()
  })

  afterEach(() => {
    cleanupDir(tempDir)
  })

  describe('API 一致性测试', () => {
    it('同步和异步方法应该返回相同的结果', async () => {
      const config = {
        app: {
          name: 'test-app',
          version: '1.0.0',
        },
        database: {
          host: 'localhost',
          port: 5432,
        },
      }

      createConfigFile(tempDir, 'config.js', config)

      const configManager = new ConfigManager({
        defaultConfigFiles: ['config.js'],
        cwd: tempDir,
      })

      const asyncResult = await configManager.getConfig()
      const syncResult = configManager.getConfigSync()

      expect(asyncResult).toEqual(syncResult)
      expect(asyncResult).toEqual(config)
    })

    it('在处理多个配置文件时，同步和异步方法应该返回相同结果', async () => {
      const baseConfig = {
        app: { name: 'test' },
        feature1: true,
      }

      const envConfig = {
        app: { debug: true },
        feature2: true,
      }

      createConfigFile(tempDir, 'config.js', baseConfig)
      createConfigFile(tempDir, 'config.dev.js', envConfig)

      const configManager = new ConfigManager({
        defaultConfigFiles: ['config.js'],
        defaultConfigExts: ['dev'],
        cwd: tempDir,
      })

      const asyncResult = await configManager.getConfig()
      const syncResult = configManager.getConfigSync()

      expect(asyncResult).toEqual(syncResult)
      expect(asyncResult).toEqual({
        app: { name: 'test', debug: true },
        feature1: true,
        feature2: true,
      })
    })

    it('在没有配置文件时，同步和异步方法都应该返回 null', async () => {
      const configManager = new ConfigManager({
        defaultConfigFiles: ['nonexistent.js'],
        cwd: tempDir,
      })

      const asyncResult = await configManager.getConfig()
      const syncResult = configManager.getConfigSync()

      expect(asyncResult).toBeNull()
      expect(syncResult).toBeNull()
    })
  })

  describe('静态方法一致性测试', () => {
    it('静态方法的同步和异步版本应该返回相同结果', async () => {
      const config1 = { key1: 'value1' }
      const config2 = { key2: 'value2' }

      const file1 = createConfigFile(tempDir, 'config1.js', config1)
      const file2 = createConfigFile(tempDir, 'config2.js', config2)

      const asyncResult = await ConfigManager.getConfig([file1, file2])
      const syncResult = ConfigManager.getConfigSync([file1, file2])

      expect(asyncResult).toEqual(syncResult)
      expect(asyncResult).toEqual({ key1: 'value1', key2: 'value2' })
    })

    it('主配置文件查找的同步和异步版本应该返回相同结果', async () => {
      createConfigFile(tempDir, 'config.js', { test: true })

      const configFiles = ['config.ts', 'config.js', 'config.json']

      const asyncResult = await ConfigManager.getMainConfigFile(
        configFiles,
        tempDir,
      )
      const syncResult = ConfigManager.getMainConfigFileSync(
        configFiles,
        tempDir,
      )

      expect(asyncResult).toBe(syncResult)
      expect(asyncResult).toBe(path.join(tempDir, 'config.js'))
    })

    it('在没有找到配置文件时，同步和异步方法都应该返回 undefined', async () => {
      const configFiles = ['nonexistent.ts', 'missing.js']

      const asyncResult = await ConfigManager.getMainConfigFile(
        configFiles,
        tempDir,
      )
      const syncResult = ConfigManager.getMainConfigFileSync(
        configFiles,
        tempDir,
      )

      expect(asyncResult).toBeUndefined()
      expect(syncResult).toBeUndefined()
    })
  })

  describe('错误处理一致性', () => {
    it('同步和异步方法应该抛出相似的错误', async () => {
      const invalidFile = path.join(tempDir, 'invalid.js')
      fs.writeFileSync(invalidFile, 'invalid javascript')

      // 测试异步错误
      let asyncError: Error | null = null
      try {
        await ConfigManager.getConfig([invalidFile])
      } catch (error) {
        asyncError = error as Error
      }

      // 测试同步错误
      let syncError: Error | null = null
      try {
        ConfigManager.getConfigSync([invalidFile])
      } catch (error) {
        syncError = error as Error
      }

      expect(asyncError).toBeDefined()
      expect(syncError).toBeDefined()
      expect(asyncError?.message).toContain(
        `Load config ${invalidFile} failed:`,
      )
      expect(syncError?.message).toContain(`Load config ${invalidFile} failed:`)
    })

    it('在处理不存在的文件时，同步和异步方法行为一致', async () => {
      const nonexistentFile = path.join(tempDir, 'nonexistent.js')

      const asyncResult = await ConfigManager.getConfig([nonexistentFile])
      const syncResult = ConfigManager.getConfigSync([nonexistentFile])

      expect(asyncResult).toBeNull()
      expect(syncResult).toBeNull()
    })
  })

  describe('性能和行为特性', () => {
    it('异步方法应该真正是异步的', async () => {
      const config = { async: true }
      createConfigFile(tempDir, 'config.js', config)

      const configManager = new ConfigManager({
        defaultConfigFiles: ['config.js'],
        cwd: tempDir,
      })

      let asyncCompleted = false
      const asyncPromise = configManager.getConfig().then(result => {
        asyncCompleted = true
        return result
      })

      // 在下一个事件循环检查异步操作是否完成
      await new Promise(resolve => setImmediate(resolve))

      // 异步操作应该已经完成（对于简单的文件操作）
      const result = await asyncPromise
      expect(result).toEqual(config)
      expect(asyncCompleted).toBe(true)
    })

    it('同步方法应该立即返回结果', () => {
      const config = { sync: true }
      createConfigFile(tempDir, 'config.js', config)

      const configManager = new ConfigManager({
        defaultConfigFiles: ['config.js'],
        cwd: tempDir,
      })

      const startTime = Date.now()
      const result = configManager.getConfigSync()
      const endTime = Date.now()

      expect(result).toEqual(config)
      // 同步操作应该很快完成（通常 < 100ms）
      expect(endTime - startTime).toBeLessThan(1000)
    })

    it('应该能处理多个并发的异步配置加载', async () => {
      const configs = Array.from({ length: 5 }, (_, i) => ({
        id: i,
        value: `config-${i}`,
      }))

      const configManagers = configs.map((config, i) => {
        createConfigFile(tempDir, `config${i}.js`, config)
        return new ConfigManager({
          defaultConfigFiles: [`config${i}.js`],
          cwd: tempDir,
        })
      })

      // 并发执行多个异步配置加载
      const promises = configManagers.map(manager => manager.getConfig())
      const results = await Promise.all(promises)

      results.forEach((result, i) => {
        expect(result).toEqual(configs[i])
      })
    })
  })

  describe('复杂场景一致性测试', () => {
    it('在复杂配置合并场景下，同步和异步方法应该一致', async () => {
      const baseConfig = {
        app: {
          name: 'complex-app',
          features: {
            auth: { enabled: true, provider: 'local' },
            api: { version: 'v1', rateLimit: 100 },
          },
        },
      }

      const devConfig = {
        app: {
          features: {
            auth: { provider: 'oauth', debug: true },
            api: { version: 'v2' },
            dev: { hotReload: true },
          },
        },
      }

      const localConfig = {
        app: {
          features: {
            auth: { debug: false },
            local: { customization: true },
          },
        },
      }

      createConfigFile(tempDir, 'config.js', baseConfig)
      createConfigFile(tempDir, 'config.dev.js', devConfig)
      createConfigFile(tempDir, 'config.local.js', localConfig)

      const configManager = new ConfigManager({
        defaultConfigFiles: ['config.js'],
        defaultConfigExts: ['dev', 'local'],
        cwd: tempDir,
      })

      const asyncResult = await configManager.getConfig()
      const syncResult = configManager.getConfigSync()

      const expectedResult = {
        app: {
          name: 'complex-app',
          features: {
            auth: { enabled: true, provider: 'oauth', debug: false },
            api: { version: 'v2', rateLimit: 100 },
            dev: { hotReload: true },
            local: { customization: true },
          },
        },
      }

      expect(asyncResult).toEqual(expectedResult)
      expect(syncResult).toEqual(expectedResult)
      expect(asyncResult).toEqual(syncResult)
    })

    it('在处理不同文件类型时，同步和异步方法应该一致', async () => {
      const jsConfig = { type: 'js', value: 1 }
      const jsonConfig = { type: 'json', value: 2 }

      createConfigFile(tempDir, 'config.js', jsConfig)
      createConfigFile(tempDir, 'config.json', jsonConfig)

      const jsFiles = [path.join(tempDir, 'config.js')]
      const jsonFiles = [path.join(tempDir, 'config.json')]

      // 测试 JS 文件
      const asyncJsResult = await ConfigManager.getConfig(jsFiles)
      const syncJsResult = ConfigManager.getConfigSync(jsFiles)
      expect(asyncJsResult).toEqual(syncJsResult)
      expect(asyncJsResult).toEqual(jsConfig)

      // 测试 JSON 文件
      const asyncJsonResult = await ConfigManager.getConfig(jsonFiles)
      const syncJsonResult = ConfigManager.getConfigSync(jsonFiles)
      expect(asyncJsonResult).toEqual(syncJsonResult)
      expect(asyncJsonResult).toEqual(jsonConfig)
    })
  })

  describe('边界情况一致性', () => {
    it('在处理空配置时，同步和异步方法应该一致', async () => {
      const emptyConfig = {}
      createConfigFile(tempDir, 'config.js', emptyConfig)

      const configFiles = [path.join(tempDir, 'config.js')]

      const asyncResult = await ConfigManager.getConfig(configFiles)
      const syncResult = ConfigManager.getConfigSync(configFiles)

      expect(asyncResult).toEqual(syncResult)
      expect(asyncResult).toEqual(emptyConfig)
    })

    it('在处理空文件列表时，同步和异步方法应该一致', async () => {
      const asyncResult = await ConfigManager.getConfig([])
      const syncResult = ConfigManager.getConfigSync([])

      expect(asyncResult).toEqual(syncResult)
      expect(asyncResult).toBeNull()
    })
  })
})
