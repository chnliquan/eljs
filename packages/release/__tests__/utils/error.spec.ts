import { run } from '@eljs/utils/cp'
import { inspect } from 'node:util'
import { describe, expect, it } from 'vitest'
/**
 * @file packages/release utils/error 模块单元测试
 * @description 测试 AppError 错误类功能
 */

import { createSafeCommandError } from '../../src/internal/safe-command-error'
import { AppError, ReleasePublishError } from '../../src/utils/error'

describe('应用错误类测试', () => {
  describe('AppError 构造函数', () => {
    it('应该能够创建 AppError 实例', () => {
      const message = '这是一个测试错误'
      const error = new AppError(message)

      expect(error).toBeInstanceOf(AppError)
      expect(error).toBeInstanceOf(Error)
    })

    it('应该正确设置错误消息', () => {
      const message = '自定义错误消息'
      const error = new AppError(message)

      expect(error.message).toBe(message)
    })

    it('应该正确设置错误名称', () => {
      const error = new AppError('测试消息')
      expect(error.name).toBe('AppError')
    })
  })

  describe('AppError 错误信息处理', () => {
    it('应该支持空字符串消息', () => {
      const error = new AppError('')
      expect(error.message).toBe('')
      expect(error.name).toBe('AppError')
    })

    it('应该支持多行错误消息', () => {
      const message = '第一行错误\n第二行错误\n第三行错误'
      const error = new AppError(message)
      expect(error.message).toBe(message)
    })

    it('应该支持包含特殊字符的错误消息', () => {
      const message = '错误: 文件 "it.js" 不存在 (代码: 404)'
      const error = new AppError(message)
      expect(error.message).toBe(message)
    })

    it('应该支持 Unicode 字符', () => {
      const message = '错误: 文件包含非法字符 ✗ 处理失败 🚫'
      const error = new AppError(message)
      expect(error.message).toBe(message)
    })
  })

  describe('AppError 继承行为', () => {
    it('应该继承自 Error 类', () => {
      const error = new AppError('测试')
      expect(error instanceof Error).toBe(true)
      expect(error instanceof AppError).toBe(true)
    })

    it('应该具有 stack 属性', () => {
      const error = new AppError('测试')
      expect(error.stack).toBeDefined()
      expect(typeof error.stack).toBe('string')
    })

    it('应该能够被 try-catch 捕获', () => {
      expect(() => {
        throw new AppError('测试错误')
      }).toThrow('测试错误')

      expect(() => {
        throw new AppError('测试错误')
      }).toThrow(AppError)
    })
  })

  describe('AppError 实例方法', () => {
    it('toString() 方法应该返回正确格式', () => {
      const error = new AppError('测试错误')
      const result = error.toString()
      expect(result).toBe('AppError: 测试错误')
    })

    it('应该支持 Error 的所有标准属性', () => {
      const error = new AppError('测试错误')

      expect(error).toHaveProperty('name')
      expect(error).toHaveProperty('message')
      expect(error).toHaveProperty('stack')
    })
  })

  describe('AppError 类型检查', () => {
    it('应该能够通过 instanceof 检查类型', () => {
      const appError = new AppError('应用错误')
      const standardError = new Error('标准错误')

      expect(appError instanceof AppError).toBe(true)
      expect(appError instanceof Error).toBe(true)
      expect(standardError instanceof AppError).toBe(false)
      expect(standardError instanceof Error).toBe(true)
    })

    it('应该能够通过 name 属性识别错误类型', () => {
      const appError = new AppError('测试')
      const standardError = new Error('测试')

      expect(appError.name).toBe('AppError')
      expect(standardError.name).toBe('Error')
    })
  })

  describe('AppError 错误传播', () => {
    it('应该能够作为 Promise rejection 使用', async () => {
      const itError = new AppError('异步错误')

      await expect(Promise.reject(itError)).rejects.toThrow('异步错误')
      await expect(Promise.reject(itError)).rejects.toBeInstanceOf(AppError)
    })

    it('应该能够重新抛出时保持错误类型', () => {
      const originalError = new AppError('原始错误')

      expect(() => {
        throw originalError
      }).toThrow(AppError)
    })
  })

  describe('AppError 边界情况', () => {
    it('应该支持非常长的错误消息', () => {
      const longMessage = 'x'.repeat(10000)
      const error = new AppError(longMessage)
      expect(error.message).toBe(longMessage)
      expect(error.message.length).toBe(10000)
    })

    it('消息参数类型应该严格为字符串', () => {
      // TypeScript 应该确保只能传入字符串
      const error = new AppError('有效消息')
      expect(typeof error.message).toBe('string')
    })
  })
})

describe('ReleasePublishError 错误类测试', () => {
  it('应该保留结构化发布进度和安全错误副本', () => {
    const cause = new Error('registry unavailable')
    const error = new ReleasePublishError(
      {
        failedPackage: 'app',
        version: '1.2.0',
        publishedPackages: ['core'],
        unpublishedPackages: ['app', 'cli'],
      },
      cause,
    )

    expect(error).toBeInstanceOf(AppError)
    expect(error.name).toBe('ReleasePublishError')
    expect(error.cause).not.toBe(cause)
    expect(error.cause).toMatchObject({
      message: 'Release operation failed',
      name: 'ReleaseCommandError',
    })
    expect(error.details).toEqual({
      failedPackage: 'app',
      version: '1.2.0',
      publishedPackages: ['core'],
      unpublishedPackages: ['app', 'cli'],
    })
    expect(error.message).toContain('Published before failure: core@1.2.0')
  })

  it('应该冻结进度数据避免调用方误改', () => {
    const error = new ReleasePublishError({
      failedPackage: 'app',
      version: '1.2.0',
      publishedPackages: ['core'],
      unpublishedPackages: ['app'],
    })

    expect(Object.isFrozen(error.details)).toBe(true)
    expect(Object.isFrozen(error.details.publishedPackages)).toBe(true)
    expect(Object.isFrozen(error.details.unpublishedPackages)).toBe(true)
  })

  const details = {
    failedPackage: 'app',
    version: '1.2.0',
    publishedPackages: [],
    unpublishedPackages: ['app'],
  }

  it('内置预检的固定诊断经重复净化后保留进度且不暴露自由文本', () => {
    const secret = 'private-preflight-token'
    const cause = createSafeCommandError({
      code: 'EPUBLISH_PREFLIGHT',
      message: secret,
      stderr: secret,
      cause: new Error(secret),
    })
    const error = new ReleasePublishError(
      { ...details, publishedPackages: ['core'] },
      cause,
    )
    expect(error.cause).toMatchObject({
      code: 'EPUBLISH_PREFLIGHT',
      message: expect.stringContaining('Release publish preflight failed'),
    })
    expect(error.message).toContain('publish access')
    expect(error.message).toContain('dependency order')
    expect(error.message).toContain('Published before failure: core@1.2.0')
    expect(inspect(error, { depth: null })).not.toContain(secret)
    expect(createSafeCommandError(error.cause).message).toBe(cause.message)
  })

  it.each([
    { isCanceled: true, message: 'Release command was canceled' },
    { timedOut: true, message: 'Release command timed out' },
  ])('预检诊断不覆盖取消或超时：$message', ({ message, ...state }) => {
    const error = new ReleasePublishError(details, {
      code: 'EPUBLISH_PREFLIGHT',
      ...state,
    })
    expect(error.cause).toMatchObject({ message, ...state })
    expect(error.message).toContain(`Reason: ${message}`)
  })

  it.each([
    ['npm error code EOTP', 'EOTP', 'fresh one-time password (OTP)'],
    ['npm ERR! code ENEEDAUTH', 'ENEEDAUTH', 'refresh your login or token'],
    ['npm error code ENOTLOGGEDIN', 'ENOTLOGGEDIN', 'registry authentication'],
    ['npm error code E401', 'E401', 'registry authentication'],
    ['npm error code E402', 'E402', 'billing and package access'],
    ['npm error code E403\r\n', 'E403', 'publish permissions'],
    ['npm error code E404', 'E404', 'package availability or access'],
    ['npm error code ECONNRESET', 'ECONNRESET', 'network connectivity'],
    ['npm ERR! code ENOTFOUND', 'ENOTFOUND', 'network connectivity'],
    ['npm error E403 403 Forbidden', 'E403', 'registry access policy'],
    ['npm ERR! 401 Unauthorized', 'E401', 'registry authentication'],
    ['npm error 402 Payment Required', 'E402', 'billing'],
    ['npm error 403 Forbidden', 'E403', 'publish permissions'],
    ['npm error 404 Not Found', 'E404', 'package availability'],
    ['ERR_PNPM_FETCH_401', 'ERR_PNPM_FETCH_401', 'registry authentication'],
    ['[ERR_PNPM_FETCH_401]', 'ERR_PNPM_FETCH_401', 'registry authentication'],
    [' [ERR_PNPM_FETCH_402] Payment Required', 'ERR_PNPM_FETCH_402', 'billing'],
    [
      '\u00a0[ERR_PNPM_FETCH_403] Forbidden',
      'ERR_PNPM_FETCH_403',
      'publish permissions',
    ],
    [
      '[ERR_PNPM_FETCH_404] Not Found',
      'ERR_PNPM_FETCH_404',
      'package availability',
    ],
    [' ERR_PNPM_FETCH_402 Payment Required', 'ERR_PNPM_FETCH_402', 'billing'],
    [
      '\u00a0ERR_PNPM_FETCH_403 Forbidden',
      'ERR_PNPM_FETCH_403',
      'publish permissions',
    ],
    [
      'ERR_PNPM_FETCH_404 Not Found',
      'ERR_PNPM_FETCH_404',
      'package availability',
    ],
  ])('从自身字符串输出提取固定诊断：%s', (output, code, hint) => {
    for (const stream of ['stderr', 'stdout']) {
      const safe = createSafeCommandError({ [stream]: output, exitCode: 1 })
      const error = new ReleasePublishError(details, safe)

      expect(safe).toMatchObject({ code, exitCode: 1 })
      expect(safe.message).toContain(code)
      expect(safe.message).toContain(hint)
      expect(safe.message).toContain('exit code 1')
      expect(error.cause).toMatchObject({
        code,
        exitCode: 1,
        message: safe.message,
      })
      expect(error.message).toContain(`Reason: ${safe.message}`)
      expect(error.cause).not.toBe(safe)
      expect(error.cause).not.toHaveProperty(stream)
    }
  })

  it('优先保留自身白名单 code，其次读取 stderr，再读取 stdout', () => {
    const output = {
      stderr: 'npm error code EOTP',
      stdout: 'npm error code E403',
    }
    expect(createSafeCommandError({ ...output, code: 'E401' }).code).toBe(
      'E401',
    )
    expect(
      createSafeCommandError({ ...output, code: 'private-token' }).code,
    ).toBe('EOTP')
    expect(
      createSafeCommandError({ ...output, stderr: 'unknown output' }).code,
    ).toBe('E403')
  })

  it.each([
    'ENOENT',
    'EACCES',
    'EPERM',
    'EAGAIN',
    'ENOMEM',
    'ENOSPC',
    'EIO',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'ECONNRESET',
    'ENOTFOUND',
    'E401',
    'E403',
    'E404',
    'EOTP',
    'ENEEDAUTH',
    'ENOTLOGGEDIN',
  ])('已有白名单字段 %s 在重复净化时保持兼容', code => {
    const safe = createSafeCommandError({ code, exitCode: 7 })
    expect(createSafeCommandError(safe)).toMatchObject({
      code,
      exitCode: 7,
      message: safe.message,
      name: safe.name,
      isCanceled: false,
      timedOut: false,
    })
  })

  it('合法代码后的输出注入只能生成固定提示', () => {
    const secret = 'dummy-private-credential'
    const raw = {
      stderr: [
        `npm error E403 403 Forbidden - https://user:${secret}@registry.invalid`,
        `npm publish --otp=${secret}`,
        `npm error code EOTP_${secret}`,
      ].join('\n'),
      stdout: `ERR_PNPM_FETCH_401 ${secret}`,
      message: secret,
      command: secret,
      cause: { code: 'EOTP', stderr: secret },
    }
    const safe = createSafeCommandError(raw)
    const error = new ReleasePublishError(details, safe)
    expect(safe.code).toBe('E403')
    expect(safe.message).toBe(
      'Release command failed (E403). Check package publish permissions and registry access policy.',
    )
    const diagnostic =
      inspect(error, { depth: null }) + JSON.stringify(error) + error.stack
    for (const forbidden of [
      secret,
      'registry.invalid',
      'https://',
      'npm publish',
    ]) {
      expect(diagnostic).not.toContain(forbidden)
    }
    expect(safe).not.toHaveProperty('cause')
    expect(safe).not.toHaveProperty('stderr')
    expect(safe).not.toHaveProperty('stdout')
    expect(safe).not.toHaveProperty('command')
  })

  it.each([
    'npm error code EOTP_private-token',
    'npm error code EOTP-private-token',
    'npm error code EOTP private-token',
    'npm error code EOTP=private-token',
    'npm error code EOTP/private-token',
    'npm error code EOTP\u0000private-token',
    'npm error code private-token-EOTP',
    'npm error E403_private-token',
    'npm error 403private-token',
    'ERR_PNPM_FETCH_403_private-token',
    'ERR_PNPM_FETCH_403-private-token',
    '[ERR_PNPM_FETCH_403_private-token]',
    '[ERR_PNPM_FETCH_403]private-token',
    '[ERR_PNPM_FETCH_403',
    'ERR_PNPM_FETCH_403]',
    'token=ERR_PNPM_FETCH_403',
    'private-token npm error code EOTP',
    'echo npm error code EOTP',
    'EOTP',
    'HTTP 403 private-token',
    'npm error code UNKNOWN',
    '',
  ])('拒绝不完整代码、任意文本和空输出：%s', output => {
    const error = new ReleasePublishError(details, {
      stderr: output,
      stdout: '',
      code: 'EOTP_private-token',
    })
    expect(error.cause).not.toHaveProperty('code')
    expect(error.cause).toMatchObject({ message: 'Release operation failed' })
    expect(error.message).toContain('Reason: Release operation failed')
    expect(inspect(error, { depth: null })).not.toContain('private-token')
  })

  it('扫描边界之外、过长及截断的行不参与代码识别', () => {
    for (const stderr of [
      `${'unknown\n'.repeat(128)}npm error code EOTP`,
      `${'x'.repeat(16 * 1024)}\nnpm error code EOTP`,
      `npm error E403 ${'x'.repeat(1024)}`,
      `${'x'.repeat(16 * 1024 - 'npm error code EOTP'.length - 1)}\nnpm error code EOTP_private-token`,
    ]) {
      expect(createSafeCommandError({ stderr }).code).toBeUndefined()
    }
    expect(
      createSafeCommandError({
        stderr: `npm error code EOTP\n${'x'.repeat(16 * 1024)}`,
      }).code,
    ).toBe('EOTP')
  })

  it('不读取输出访问器、原型、cause 图或非字符串输出', () => {
    let reads = 0
    const getter = {
      get() {
        reads++
        throw new Error('private-getter-secret')
      },
    }
    const untrusted = Object.create({
      code: 'EOTP',
      stderr: 'npm error code EOTP',
      stdout: 'npm error code E401',
      timedOut: true,
      isCanceled: true,
    })
    for (const key of [
      'code',
      'stderr',
      'stdout',
      'name',
      'message',
      'cause',
      'errors',
      'exitCode',
      'timedOut',
      'isCanceled',
    ]) {
      Object.defineProperty(untrusted, key, getter)
    }
    const coercible = {
      toString() {
        reads++
        throw new Error('private-coercion-secret')
      },
    }
    for (const cause of [
      untrusted,
      Object.create({ stderr: 'npm error code EOTP', code: 'E401' }),
      { cause: { stderr: 'npm error code EOTP' } },
      { message: 'npm error code EOTP' },
      { stderr: coercible, stdout: new String('npm error code EOTP') },
      { stderr: Buffer.from('npm error code EOTP'), stdout: null },
    ]) {
      const error = new ReleasePublishError(details, cause)
      expect(error.cause).toMatchObject({
        message: 'Release operation failed',
        isCanceled: false,
        timedOut: false,
      })
      expect(error.cause).not.toHaveProperty('code')
    }
    expect(reads).toBe(0)
  })

  it.each([
    [
      { isCanceled: true, timedOut: true },
      false,
      'Release command was canceled',
    ],
    [{ timedOut: true }, false, 'Release command timed out'],
    [{ name: 'TimeoutError' }, false, 'Release command timed out'],
    [{ name: 'AbortError' }, false, 'Release command was canceled'],
    [{ timedOut: true }, true, 'Release command was canceled'],
  ])('取消及超时优先于输出提示：%j', (state, canceled, message) => {
    const safe = createSafeCommandError(
      { ...state, stderr: 'npm error code EOTP', exitCode: 1 },
      canceled,
    )
    const error = new ReleasePublishError(details, safe)
    expect(error.cause).toMatchObject({
      message,
      code: 'EOTP',
      exitCode: 1,
      isCanceled: safe.isCanceled,
      timedOut: safe.timedOut,
      name: safe.name,
    })
    expect(error.message).toContain(`Reason: ${message}`)
    expect(error.message).not.toContain('one-time password')
  })

  it('空输出保留退出码回退，无原因时不添加诊断', () => {
    expect(
      new ReleasePublishError(details, { stdout: '', stderr: '', exitCode: 1 })
        .cause,
    ).toMatchObject({ message: 'Release command failed (exit code 1)' })
    const error = new ReleasePublishError(details)
    expect(error.cause).toBeUndefined()
    expect(error.message).not.toContain('Reason:')
  })

  it('不保留命令、输出、聚合异常和任意 cause 中的凭据', () => {
    const secret = 'dummy-private-otp'
    const cause = Object.assign(
      new AggregateError([new Error(secret)], secret, {
        cause: new Error(secret),
      }),
      {
        command: `npm publish --otp=${secret}`,
        escapedCommand: secret,
        shortMessage: secret,
        stdout: secret,
        stderr: secret,
        code: 'EOTP',
        exitCode: 1,
      },
    )
    const originalStack = cause.stack
    const error = new ReleasePublishError(details, cause)
    expect(error.cause).toMatchObject({ code: 'EOTP', exitCode: 1 })
    expect(inspect(error, { depth: null })).not.toContain(secret)
    expect(JSON.stringify(error)).not.toContain(secret)
    expect(error.stack).not.toContain(secret)
    expect(cause.stack).toBe(originalStack)
    expect(cause.message).toBe(secret)
  })

  it('真实 Execa 启动失败不暴露 OTP 或 registry 用户信息', async () => {
    const secret = 'dummy-private-otp'
    const cause = await run(
      'eljs-deliberately-missing-publish-command',
      [
        'publish',
        `--otp=${secret}`,
        '--registry=https://user:dummy-password@registry.invalid',
      ],
      { env: { PATH: '' }, extendEnv: false },
    ).catch(error => error)
    expect(cause.code).toBe('ENOENT')
    expect(cause.message).toContain(secret)
    const error = new ReleasePublishError(details, cause)
    expect(error.cause).toMatchObject({ code: 'ENOENT' })
    const diagnostic = inspect(error, { depth: null }) + JSON.stringify(error)
    expect(diagnostic).not.toContain(secret)
    expect(diagnostic).not.toContain('dummy-password')
    expect(diagnostic).not.toContain('registry.invalid')
  })

  it.each([
    [{ name: 'AbortError' }, { name: 'AbortError', isCanceled: true }],
    [{ isCanceled: true }, { name: 'AbortError', isCanceled: true }],
    [{ timedOut: true }, { name: 'TimeoutError', timedOut: true }],
    [{ name: 'TimeoutError' }, { name: 'TimeoutError', timedOut: true }],
  ])('保留取消与超时分类 %j', (cause, expected) => {
    expect(new ReleasePublishError(details, cause).cause).toMatchObject(
      expected,
    )
  })

  it('不执行错误对象的 getter，也不信任未知错误码', () => {
    const cause = Object.defineProperty(
      { code: 'secret-error-code', exitCode: Infinity },
      'name',
      {
        get() {
          throw new Error('must not read accessors')
        },
      },
    )
    const error = new ReleasePublishError(details, cause)
    expect(error.cause).not.toHaveProperty('code')
    expect(error.cause).not.toHaveProperty('exitCode')
    expect(
      () =>
        new ReleasePublishError(
          details,
          new Proxy(
            {},
            {
              getOwnPropertyDescriptor() {
                throw new Error('untrusted proxy')
              },
            },
          ),
        ),
    ).not.toThrow()
  })
})
