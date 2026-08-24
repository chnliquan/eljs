import * as fs from 'node:fs'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { ConfigMerge, ConfigValidator } from '../src'
import { ConfigErrorCode, ConfigLoadError, ConfigManager } from '../src'
import {
  cleanupDir,
  createConfigFile,
  createRawConfigFile,
  createTempDir,
} from './test-utils'

describe('ConfigManager 加载契约测试', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = createTempDir('config-contract-test-')
  })

  afterEach(() => {
    cleanupDir(tempDir)
  })

  it('同步和异步加载应该一致保留普通 CJS 对象的 default 字段', async () => {
    const configFile = createRawConfigFile(
      tempDir,
      'config.cjs',
      'module.exports = { default: { enabled: true } }',
    )

    const asyncResult = await ConfigManager.getConfig([configFile])
    const syncResult = ConfigManager.getConfigSync([configFile])

    expect(asyncResult).toEqual({ default: { enabled: true } })
    expect(syncResult).toEqual(asyncResult)
  })

  it('数据文件应该保留名为 default 的配置字段', async () => {
    const configFile = createConfigFile(tempDir, 'config.json', {
      default: { enabled: true },
      mode: 'test',
    })

    const asyncResult = await ConfigManager.getConfig([configFile])
    const syncResult = ConfigManager.getConfigSync([configFile])

    expect(asyncResult).toEqual({
      default: { enabled: true },
      mode: 'test',
    })
    expect(syncResult).toEqual(asyncResult)
  })

  it.each([
    ['config.yaml', 'enabled: true\nmode: yaml\n'],
    ['config.yml', 'enabled: true\nmode: yaml\n'],
  ])('应该通过同步和异步 API 加载 %s', async (filename, content) => {
    const configFile = createRawConfigFile(tempDir, filename, content)

    const asyncResult = await ConfigManager.getConfig([configFile])
    const syncResult = ConfigManager.getConfigSync([configFile])

    expect(asyncResult).toEqual({ enabled: true, mode: 'yaml' })
    expect(syncResult).toEqual(asyncResult)
  })

  it('TypeScript 加载不应该生成临时文件并应支持相对依赖', async () => {
    createRawConfigFile(tempDir, 'helper.ts', 'export const enabled = true')
    const configFile = createRawConfigFile(
      tempDir,
      'config.ts',
      "import { enabled } from './helper'\nexport default { enabled }",
    )

    await expect(ConfigManager.getConfig([configFile])).resolves.toEqual({
      enabled: true,
    })
    expect(
      fs.readdirSync(tempDir).filter(file => file.includes('.eljs-')),
    ).toEqual([])
  })

  it.skipIf(process.platform === 'win32')(
    'TypeScript 配置应该可以从只读目录加载',
    async () => {
      createRawConfigFile(
        tempDir,
        'readonly-helper.ts',
        'export const port = 3000',
      )
      const configFile = createRawConfigFile(
        tempDir,
        'readonly-config.ts',
        "import { port } from './readonly-helper'\nexport default { port }",
      )
      fs.chmodSync(tempDir, 0o555)

      try {
        await expect(ConfigManager.getConfig([configFile])).resolves.toEqual({
          port: 3000,
        })
        expect(ConfigManager.getConfigSync([configFile])).toEqual({
          port: 3000,
        })
      } finally {
        fs.chmodSync(tempDir, 0o700)
      }
    },
  )

  it('配置文件导出原始值时应该抛出结构化错误', async () => {
    const configFile = createRawConfigFile(tempDir, 'config.json', '"text"')

    await expect(ConfigManager.getConfig([configFile])).rejects.toMatchObject({
      code: ConfigErrorCode.InvalidConfig,
      configFile,
      format: '.json',
    })
    expect(() => ConfigManager.getConfigSync([configFile])).toThrowError(
      expect.objectContaining({
        code: ConfigErrorCode.InvalidConfig,
        configFile,
        format: '.json',
      }),
    )
  })

  it('配置文件导出数组时应该抛出结构化错误', async () => {
    const configFile = createRawConfigFile(tempDir, 'config.json', '[1, 2]')

    await expect(ConfigManager.getConfig([configFile])).rejects.toMatchObject({
      code: ConfigErrorCode.InvalidConfig,
      configFile,
      format: '.json',
    })
    expect(() => ConfigManager.getConfigSync([configFile])).toThrowError(
      expect.objectContaining({
        code: ConfigErrorCode.InvalidConfig,
        configFile,
        format: '.json',
      }),
    )
  })

  it.each([
    ['数组', [1, 2]],
    ['类实例', new (class CustomConfig {})()],
  ])('默认配置为%s时应该抛出结构化错误', async (_label, defaultConfig) => {
    await expect(
      ConfigManager.getConfig([], defaultConfig),
    ).rejects.toMatchObject({
      code: ConfigErrorCode.InvalidConfig,
      configFile: '<default>',
    })
    expect(() => ConfigManager.getConfigSync([], defaultConfig)).toThrowError(
      expect.objectContaining({
        code: ConfigErrorCode.InvalidConfig,
        configFile: '<default>',
      }),
    )
  })

  it('未知文件格式应该抛出 UnsupportedFormat 错误', async () => {
    const configFile = createRawConfigFile(
      tempDir,
      'config.toml',
      'enabled = true',
    )

    await expect(ConfigManager.getConfig([configFile])).rejects.toMatchObject({
      code: ConfigErrorCode.UnsupportedFormat,
      configFile,
      format: '.toml',
    })
    expect(() => ConfigManager.getConfigSync([configFile])).toThrowError(
      expect.objectContaining({
        code: ConfigErrorCode.UnsupportedFormat,
        configFile,
        format: '.toml',
      }),
    )
  })

  it.skipIf(process.platform === 'win32')(
    '路径权限错误不应该被当作文件不存在',
    async () => {
      const protectedDir = path.join(tempDir, 'protected')
      fs.mkdirSync(protectedDir)
      const configFile = createConfigFile(protectedDir, 'config.json', {
        enabled: true,
      })
      fs.chmodSync(protectedDir, 0o000)

      try {
        await expect(
          ConfigManager.getMainConfigFile([configFile]),
        ).rejects.toMatchObject({
          code: ConfigErrorCode.FileAccessFailed,
          configFile,
        })
        expect(() =>
          ConfigManager.getMainConfigFileSync([configFile]),
        ).toThrowError(
          expect.objectContaining({
            code: ConfigErrorCode.FileAccessFailed,
            configFile,
          }),
        )
      } finally {
        fs.chmodSync(protectedDir, 0o700)
      }
    },
  )

  it('同步加载 mjs 时应该抛出明确的不支持错误', async () => {
    const configFile = createRawConfigFile(
      tempDir,
      'config.mjs',
      'export default { enabled: true }',
    )

    await expect(ConfigManager.getConfig([configFile])).resolves.toEqual({
      enabled: true,
    })
    expect(() => ConfigManager.getConfigSync([configFile])).toThrowError(
      expect.objectContaining({
        code: ConfigErrorCode.SyncFormatUnsupported,
        configFile,
        format: '.mjs',
      }),
    )
  })

  it('reload 应该绕过异步 ESM 模块缓存', async () => {
    const configFile = createRawConfigFile(
      tempDir,
      'reload.mjs',
      'export default { version: 1 }',
    )

    await expect(ConfigManager.getConfig([configFile])).resolves.toEqual({
      version: 1,
    })
    createRawConfigFile(tempDir, 'reload.mjs', 'export default { version: 2 }')

    await expect(
      ConfigManager.getConfig([configFile], undefined, { reload: true }),
    ).resolves.toEqual({ version: 2 })
  })

  it('reload 应该刷新 package-scoped ESM JavaScript 入口', async () => {
    createRawConfigFile(tempDir, 'package.json', '{"type":"module"}')
    const counterName = '__eljsConfigReloadEvaluationCount'
    const configFile = createRawConfigFile(
      tempDir,
      'reload.js',
      `globalThis.${counterName} = (globalThis.${counterName} ?? 0) + 1; export default { evaluationCount: globalThis.${counterName}, version: 1 }`,
    )

    try {
      await expect(ConfigManager.getConfig([configFile])).resolves.toEqual({
        evaluationCount: 1,
        version: 1,
      })
      createRawConfigFile(
        tempDir,
        'reload.js',
        `globalThis.${counterName} = (globalThis.${counterName} ?? 0) + 1; export default { evaluationCount: globalThis.${counterName}, version: 2 }`,
      )

      await expect(
        ConfigManager.getConfig([configFile], undefined, { reload: true }),
      ).resolves.toEqual({ evaluationCount: 2, version: 2 })
    } finally {
      Reflect.deleteProperty(globalThis, counterName)
    }
  })

  it('reload 应该刷新 CommonJS 入口', async () => {
    const configFile = createRawConfigFile(
      tempDir,
      'reload.cjs',
      'module.exports = { version: 1 }',
    )

    await expect(ConfigManager.getConfig([configFile])).resolves.toEqual({
      version: 1,
    })
    createRawConfigFile(
      tempDir,
      'reload.cjs',
      'module.exports = { version: 2 }',
    )

    await expect(
      ConfigManager.getConfig([configFile], undefined, { reload: true }),
    ).resolves.toEqual({ version: 2 })
  })

  it('解析失败时应该保留原始异常作为 cause', async () => {
    const configFile = path.join(tempDir, 'invalid.json')
    createRawConfigFile(tempDir, 'invalid.json', '{ invalid')

    let caught: unknown
    try {
      await ConfigManager.getConfig([configFile])
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(ConfigLoadError)
    expect(caught).toMatchObject({
      code: ConfigErrorCode.LoadFailed,
      configFile,
      format: '.json',
    })
    expect((caught as ConfigLoadError).cause).toBeInstanceOf(Error)
  })

  it('应该允许通过自定义合并函数替换数组', async () => {
    const baseFile = createConfigFile(tempDir, 'base.json', {
      plugins: ['base'],
      retained: true,
    })
    const overrideFile = createConfigFile(tempDir, 'override.json', {
      plugins: ['override'],
    })
    const merge: ConfigMerge = (baseConfig, overrideConfig) => ({
      ...baseConfig,
      ...overrideConfig,
    })

    const asyncResult = await ConfigManager.getConfig(
      [baseFile, overrideFile],
      undefined,
      { merge },
    )
    const syncResult = ConfigManager.getConfigSync(
      [baseFile, overrideFile],
      undefined,
      { merge },
    )

    expect(asyncResult).toEqual({ plugins: ['override'], retained: true })
    expect(syncResult).toEqual(asyncResult)
  })

  it('应该在全部配置合并后执行验证与清洗', async () => {
    createConfigFile(tempDir, 'config.json', {
      port: 3000,
    })
    const manager = new ConfigManager({
      defaultConfigFiles: ['config.json'],
      cwd: tempDir,
      validate: (config, context) => ({
        ...config,
        sources: context.configFiles.map(file => path.basename(file)),
        loadedSources: context.loadedConfigFiles.map(file =>
          path.basename(file),
        ),
        validated: true,
      }),
    })

    await expect(manager.getConfig()).resolves.toEqual({
      port: 3000,
      loadedSources: ['config.json'],
      sources: ['config.json'],
      validated: true,
    })
  })

  it('验证错误应该指向最后一个实际加载的配置文件', async () => {
    const loadedFile = createConfigFile(tempDir, 'loaded.json', {
      enabled: true,
    })
    const missingFile = path.join(tempDir, 'missing.json')
    let validationContext: Parameters<ConfigValidator>[1] | undefined

    await expect(
      ConfigManager.getConfig([loadedFile, missingFile], undefined, {
        validate: (config, context) => {
          validationContext = context
          throw new Error('invalid configuration')
        },
      }),
    ).rejects.toMatchObject({
      code: ConfigErrorCode.ValidationFailed,
      configFile: loadedFile,
    })
    expect(validationContext).toEqual({
      configFiles: [loadedFile, missingFile],
      loadedConfigFiles: [loadedFile],
    })
  })

  it('自定义合并或验证失败时应该抛出对应错误码', async () => {
    const configFile = createConfigFile(tempDir, 'config.json', {
      enabled: true,
    })

    await expect(
      ConfigManager.getConfig(
        [configFile],
        { base: true },
        {
          merge: () => {
            throw new Error('merge failed')
          },
        },
      ),
    ).rejects.toMatchObject({ code: ConfigErrorCode.MergeFailed })

    await expect(
      ConfigManager.getConfig(
        [configFile],
        { base: true },
        { merge: () => [] },
      ),
    ).rejects.toMatchObject({ code: ConfigErrorCode.MergeFailed })

    expect(() =>
      ConfigManager.getConfigSync([configFile], undefined, {
        validate: () => {
          throw new Error('schema failed')
        },
      }),
    ).toThrowError(
      expect.objectContaining({ code: ConfigErrorCode.ValidationFailed }),
    )

    await expect(
      ConfigManager.getConfig([configFile], undefined, {
        validate: () => Promise.resolve({}) as unknown as object,
      }),
    ).rejects.toMatchObject({ code: ConfigErrorCode.ValidationFailed })
  })
})
