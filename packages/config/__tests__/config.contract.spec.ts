import * as fs from 'node:fs'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

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

  it('TypeScript 临时转译文件应该在加载后清理', async () => {
    const configFile = createRawConfigFile(
      tempDir,
      'config.ts',
      'export default { enabled: true as boolean }',
    )

    await expect(ConfigManager.getConfig([configFile])).resolves.toEqual({
      enabled: true,
    })
    expect(
      fs.readdirSync(tempDir).filter(file => file.includes('.eljs-')),
    ).toEqual([])
  })

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
    const merge = (baseConfig: object, overrideConfig: object): object => ({
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
        validated: true,
      }),
    })

    await expect(manager.getConfig()).resolves.toEqual({
      port: 3000,
      sources: ['config.json'],
      validated: true,
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

    expect(() =>
      ConfigManager.getConfigSync([configFile], undefined, {
        validate: () => {
          throw new Error('schema failed')
        },
      }),
    ).toThrowError(
      expect.objectContaining({ code: ConfigErrorCode.ValidationFailed }),
    )
  })
})
