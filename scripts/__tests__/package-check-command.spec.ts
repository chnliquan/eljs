import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { runPackageCheckCommand } from '../package-check-command'

describe('打包校验命令', () => {
  it('正常命令返回标准输出，并继承校验环境和指定目录', () => {
    expect(
      runPackageCheckCommand(
        process.execPath,
        [
          '-e',
          'console.log(JSON.stringify({ cwd: process.cwd(), ci: process.env.CI, notifier: process.env.NO_UPDATE_NOTIFIER }))',
        ],
        { cwd: process.cwd() },
      ),
    ).toBe(
      JSON.stringify({
        cwd: process.cwd(),
        ci: 'true',
        notifier: '1',
      }),
    )
  })

  it('忽略 SIGTERM 的真实子进程超时后仍能终止并报告具体命令', () => {
    // fixture 自行兜底退出，避免终止逻辑回归时把测试进程永久阻塞
    const args = [
      '-e',
      'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000); setTimeout(() => process.exit(0), 2000)',
    ]
    const started = performance.now()
    expect(() =>
      runPackageCheckCommand(process.execPath, args, {
        cwd: process.cwd(),
        timeout: 250,
      }),
    ).toThrow(
      `Package verification command timed out after 250 ms: ${process.execPath} ${args.join(' ')}`,
    )
    expect(performance.now() - started).toBeLessThan(1500)
  })

  it('非零退出保留退出码和诊断输出', () => {
    expect(() =>
      runPackageCheckCommand(
        process.execPath,
        ['-e', 'console.error("fixture failure"); process.exit(3)'],
        { cwd: process.cwd() },
      ),
    ).toThrow('failed with exit code 3.\nfixture failure')
  })

  it('启动失败与执行超时区分报告', () => {
    expect(() =>
      runPackageCheckCommand(
        path.join(tmpdir(), `eljs-missing-command-${randomUUID()}`),
        [],
        { cwd: process.cwd() },
      ),
    ).toThrow('could not run (ENOENT)')
  })
})
