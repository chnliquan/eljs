import cp from 'node:child_process'
import { EOL } from 'node:os'
import { read } from 'read'

import { UtilsError } from '../error'
import { isObject } from '../guards'
import type { UtilsRuntime } from '../observability'
import { emitUtilsEvent, emitUtilsLog } from '../observability/internal'
import { findExecutable } from './command'

/**
 * sudo 子进程选项
 */
export interface SudoOptions {
  /**
   * 是否在当前进程内短期缓存交互输入的密码
   * @remarks 默认关闭，缓存仅保存在内存中并在有效期结束后失效
   */
  cachePassword?: boolean

  /** 直接提供给 sudo 的密码 */
  password?: string

  /**
   * 密码内存缓存有效期，单位为毫秒
   * @defaultValue 300000
   */
  passwordCacheTtlMs?: number

  /** 交互读取密码时显示的提示文本 */
  prompt?: string

  /** 当前运行环境使用的日志与监控适配器 */
  runtime?: UtilsRuntime

  /**
   * 传给 Node.js `spawn` 的选项
   * @remarks 标准输入、输出和错误流固定为 `pipe`
   */
  spawnOptions?: cp.SpawnOptions
}

/**
 * 进程内 sudo 密码缓存
 * @internal
 */
interface CachedSudoPassword {
  /** 缓存失效时间的 Unix 毫秒时间戳 */
  expiresAt: number

  /** 调用方通过交互输入的密码 */
  value: string
}

let cachedPassword: CachedSudoPassword | undefined

/**
 * 主动清除当前进程内的 sudo 密码缓存
 */
export function clearCachedSudoPassword(): void {
  cachedPassword = undefined
}

/**
 * 以 sudo 模式执行命令并等待子进程退出
 * @param options - 选项
 * @returns 子进程以退出码 `0` 结束后完成
 * @throws Windows 不支持 sudo、未找到可执行文件、启动失败或退出码非零时抛出 {@link UtilsError}
 */
export async function sudo(options?: SudoOptions): Promise<void>
/**
 * 以 sudo 模式执行命令并等待子进程退出
 * @param args - 传给 sudo 的命令参数
 * @param options - 选项
 * @returns 子进程以退出码 `0` 结束后完成
 * @throws Windows 不支持 sudo、未找到可执行文件、启动失败或退出码非零时抛出 {@link UtilsError}
 */
export async function sudo(args: string[], options?: SudoOptions): Promise<void>
export async function sudo(
  args?: string[] | SudoOptions,
  options?: SudoOptions,
): Promise<void> {
  if (isObject(args)) {
    options = args
    args = []
  }

  const commandArgs = (args ?? []) as string[]
  const runtime = options?.runtime
  const startedAt = Date.now()

  emitUtilsEvent(runtime, {
    attributes: { argumentCount: commandArgs.length },
    operation: 'cp.sudo',
    phase: 'start',
    timestamp: startedAt,
  })

  try {
    if (process.platform === 'win32') {
      throw new UtilsError(
        'ERR_UNSUPPORTED_PLATFORM',
        'sudo is not supported on Windows',
        {
          details: { platform: process.platform },
          operation: 'cp.sudo',
        },
      )
    }

    const bin = await findExecutable('sudo')

    if (!bin) {
      throw new UtilsError(
        'ERR_EXECUTABLE_NOT_FOUND',
        'Unable to find the sudo executable',
        { operation: 'cp.sudo' },
      )
    }

    await spawnSudo(bin, commandArgs, options)
    emitUtilsEvent(runtime, {
      attributes: { argumentCount: commandArgs.length },
      durationMs: Date.now() - startedAt,
      operation: 'cp.sudo',
      phase: 'success',
      timestamp: Date.now(),
    })
  } catch (error) {
    emitUtilsEvent(runtime, {
      attributes: { argumentCount: commandArgs.length },
      durationMs: Date.now() - startedAt,
      error,
      operation: 'cp.sudo',
      phase: 'failure',
      timestamp: Date.now(),
    })
    throw error
  }
}

/**
 * 启动 sudo 并把进程事件转换为单一完成 Promise
 * @param bin - sudo 可执行文件路径
 * @param commandArgs - 传给 sudo 的命令参数
 * @param options - sudo 选项
 * @returns 子进程完成 Promise
 * @internal
 */
async function spawnSudo(
  bin: string,
  commandArgs: string[],
  options: SudoOptions | undefined,
): Promise<void> {
  const passwordMarker = '#node-sudo-passwd#'
  const {
    cachePassword = false,
    password,
    passwordCacheTtlMs = 5 * 60_000,
    prompt = 'sudo requires your password',
    runtime,
    spawnOptions = {},
  } = options ?? {}
  const sudoArgs = ['-S', '-p', passwordMarker, ...commandArgs]

  await new Promise<void>((resolve, reject) => {
    let child: cp.ChildProcess

    try {
      child = cp.spawn(bin, sudoArgs, { ...spawnOptions, stdio: 'pipe' })
    } catch (cause) {
      reject(
        new UtilsError('ERR_PROCESS_SPAWN', 'Unable to spawn sudo', {
          cause,
          operation: 'cp.sudo',
        }),
      )
      return
    }

    let settled = false
    let stderrBuffer = ''

    const settle = (error?: Error) => {
      if (settled) {
        return
      }

      settled = true
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    }

    const log = (level: 'info' | 'warn', message: string) => {
      if (!message) {
        return
      }

      if (runtime?.logger) {
        emitUtilsLog(runtime, { level, message, operation: 'cp.sudo' })
      } else {
        console.log(message)
      }
    }

    const writePassword = (value: string) => {
      try {
        child.stdin?.write(value + EOL)
      } catch (cause) {
        child.kill()
        settle(
          new UtilsError(
            'ERR_PROCESS_SPAWN',
            'Unable to write the sudo password',
            { cause, operation: 'cp.sudo' },
          ),
        )
      }
    }

    const requestPassword = () => {
      const cached = getCachedPassword()

      if (password) {
        writePassword(password)
        return
      }

      if (cachePassword && cached) {
        writePassword(cached)
        return
      }

      void read({ prompt, silent: true }).then(
        value => {
          if (cachePassword) {
            cachedPassword = {
              expiresAt: Date.now() + Math.max(0, passwordCacheTtlMs),
              value,
            }
          }
          writePassword(value)
        },
        cause => {
          child.kill()
          settle(
            new UtilsError(
              'ERR_PROCESS_SPAWN',
              'Unable to read the sudo password',
              { cause, operation: 'cp.sudo' },
            ),
          )
        },
      )
    }

    child.stdout?.on('data', chunk => {
      log('info', chunk.toString().trim())
    })

    child.stderr?.on('data', chunk => {
      stderrBuffer += chunk.toString()
      let markerIndex = stderrBuffer.indexOf(passwordMarker)

      while (markerIndex >= 0) {
        log('warn', stderrBuffer.slice(0, markerIndex).trim())
        stderrBuffer = stderrBuffer.slice(markerIndex + passwordMarker.length)
        requestPassword()
        markerIndex = stderrBuffer.indexOf(passwordMarker)
      }

      const lines = stderrBuffer.split(/\r?\n/)
      stderrBuffer = lines.pop() ?? ''
      lines.forEach(line => log('warn', line.trim()))
    })

    child.once('error', cause => {
      settle(
        new UtilsError('ERR_PROCESS_SPAWN', 'Unable to spawn sudo', {
          cause,
          operation: 'cp.sudo',
        }),
      )
    })

    child.once('close', (exitCode, signal) => {
      log('warn', stderrBuffer.trim())

      if (exitCode === 0) {
        settle()
        return
      }

      settle(
        new UtilsError(
          'ERR_PROCESS_EXIT',
          `sudo exited with code ${String(exitCode)}`,
          {
            details: { exitCode, signal },
            operation: 'cp.sudo',
          },
        ),
      )
    })
  })
}

/**
 * 返回仍在有效期内的 sudo 密码缓存
 * @returns 有效密码或 `undefined`
 * @internal
 */
function getCachedPassword(): string | undefined {
  if (!cachedPassword) {
    return undefined
  }

  if (cachedPassword.expiresAt <= Date.now()) {
    clearCachedSudoPassword()
    return undefined
  }

  return cachedPassword.value
}
