# 统一 CLI 进程引导逻辑到 @eljs/utils/cli 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `create`、`create-template`、`release` 三个 CLI 包重复的进程信号处理、错误分类外壳与 update-notifier 更新提示逻辑提取为 `@eljs/utils/cli` 的共享导出 `runCliProcess` 与 `notifyUpdates`，消除漂移并让 release 获得与 create 一致的更新提示行为。

**Architecture:** `@eljs/utils` 新增 `src/cli/run-cli-process.ts`（进程外壳：信号注册 + 错误分类 + 退出码）与 `src/cli/notify-updates.ts`（fire-and-forget 更新提示）。域知识（各包 AppError、取消码）通过回调参数注入，utils 不感知任何域错误码。update-notifier 声明为 utils 的 optional peerDependency；动态 import 保证未安装它的消费者零成本。三个包的 cli.ts 删除约 60 行重复后改为参数化调用。

**Tech Stack:** TypeScript (ESM/CJS dual)、Vitest 4、pnpm workspace、rslib、update-notifier ^7.3.1

**Spec:** 2026-09-20 会话内批准的设计（brainstorming 结论：方案 A——提取到 `@eljs/utils/cli`，update-notifier 用 optional peerDependency 解除依赖顾虑；统一语义包含 release 补齐取消分类、跳过只读命令、动态 import、失败兜底，日志统一 `Cancelling ${name} after ${signal}` 模板）

## Global Constraints

- 所有 TSDoc、实现注释使用中文；TSDoc 摘要/描述不以中英文句号结尾
- 公共 API（`runCliProcess`、`notifyUpdates`、`RunCliProcessOptions`、`NotifyUpdatesOptions`）必须有标准 TSDoc（`@param`、`@returns`、`@remarks` 按需）
- 代码不加与仓库规则无关的注释；关键不变量（fire-and-forget、退出码稳定性）用简短中文注释说明原因
- Node 版本底线 `>=22.14.0`，无需降级语法
- 每个 task 结束时运行对应包的 test，全部完成后运行根 `pnpm lint` 与 `pnpm typecheck`
- 提交信息遵循现有 conventional commits 风格（`refactor:` / `test:` / `chore:`）
- utils 的 rslib 入口为 `./src/**` 通配，新增文件**无需**改 rslib 配置；但 utils `package.json` 的 `exports` 已按子目录生成，`./cli` 子路径已存在，**无需**新增 exports 条目
- 现有三份 cli.ts 的对外行为（退出码 130/1、日志文案 `Cancelling create after SIGINT` 等）必须逐字保持——现有测试断言了这些文案

---

### Task 1: utils 新增 runCliProcess（TDD）

**Files:**

- Create: `packages/utils/src/cli/run-cli-process.ts`
- Test: `packages/utils/__tests__/cli/run-cli-process.spec.ts`

**Interfaces:**

- Consumes: `@eljs/utils/logger` 的 `logger`（utils 内相对导入 `../logger` 的 logger 实例）
- Produces:

```ts
/** 首次终止信号后等待异步清理完成的最长时间（毫秒） */
export const CLI_FORCE_EXIT_GRACE_PERIOD_MS = 5_000

export interface RunCliProcessOptions {
  /** 命令名，用于取消日志与错误消息 */
  name: string
  /** CLI 主流程，接收进程取消信号 */
  run(signal: AbortSignal): Promise<void>
  /** 构造进程信号取消时注入 controller 的错误 */
  createCancelReason(signal: NodeJS.Signals): unknown
  /** 判定主流程抛出的错误是否为用户取消 */
  isCancellation(error: unknown): boolean
}

/**
 * 运行 CLI 进程外壳……
 */
export function runCliProcess(options: RunCliProcessOptions): Promise<void>
```

- [ ] **Step 1: 写失败测试**

测试文件 `packages/utils/__tests__/cli/run-cli-process.spec.ts` 完整内容：

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  runCliProcess,
  CLI_FORCE_EXIT_GRACE_PERIOD_MS,
} from '../../src/cli/run-cli-process'

class TestAppError extends Error {
  public constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'TestAppError'
  }
}

describe('runCliProcess', () => {
  const createCancelReason = (signal: NodeJS.Signals) =>
    new TestAppError(`Operation received ${signal}`, 'OPERATION_CANCELLED')
  const isCancellation = (error: unknown) =>
    error instanceof TestAppError &&
    (error.code === 'OPERATION_ABORTED' || error.code === 'OPERATION_CANCELLED')

  const runHarness = (options?: { run?: () => Promise<void> }) =>
    runCliProcess({
      name: 'create',
      createCancelReason,
      isCancellation,
      run: options?.run ?? vi.fn().mockResolvedValue(undefined),
    })

  beforeEach(() => {
    process.exitCode = undefined
  })

  afterEach(() => {
    process.exitCode = undefined
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('运行主流程并保持退出码未定义', async () => {
    const run = vi.fn().mockResolvedValue(undefined)

    await runHarness({ run })

    expect(run).toHaveBeenCalledWith(expect.any(AbortSignal))
    expect(process.exitCode).toBeUndefined()
  })

  it('域错误记录 logger.error 且退出码为 1', async () => {
    const error = new TestAppError('Domain failure')
    const loggerError = vi
      .spyOn(await import('../../src/logger'), 'logger')
      .mockImplementation(() => {})
    const run = vi.fn().mockRejectedValue(error)

    await runHarness({ run })

    expect(loggerError).toHaveBeenCalledWith('Domain failure')
    expect(process.exitCode).toBe(1)
  })
})
```

注意：`logger.error` 的 spy 写法需实际执行时校准（logger 是 `import { logger } from '../logger'` 的对象成员，用 `vi.spyOn(logger, 'error')` 更直接）。执行时按此调整，不要照抄占位。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run packages/utils/__tests__/cli/run-cli-process.spec.ts`
Expected: FAIL，模块不存在

- [ ] **Step 3: 写实现**

`packages/utils/src/cli/run-cli-process.ts` 完整内容（把三份 cli.ts 的外壳逐行合并，行为保持与 create 包一致的超集）：

```ts
import { logger } from '../logger'

/** 首次终止信号后等待异步清理完成的最长时间（毫秒） */
export const CLI_FORCE_EXIT_GRACE_PERIOD_MS = 5_000

/**
 * CLI 进程外壳的域注入参数
 */
export interface RunCliProcessOptions {
  /**
   * 命令名，用于取消日志与错误消息
   */
  name: string
  /**
   * CLI 主流程，接收进程取消信号
   */
  run(signal: AbortSignal): Promise<void>
  /**
   * 构造进程信号取消时注入 controller 的错误
   *
   * @remarks
   * 返回值会作为 `AbortController.abort` 的 reason 抛给上层错误分类
   */
  createCancelReason(signal: NodeJS.Signals): unknown
  /**
   * 判定主流程抛出的错误是否为用户取消
   *
   * @remarks
   * 命中时进程按 130 退出，语义对齐 Unix 终止信号
   */
  isCancellation(error: unknown): boolean
}

/**
 * 运行 CLI 进程外壳
 *
 * @remarks
 * 内聚 SIGINT/SIGTERM 注册、首次信号宽限期强退、二次信号立即退出、
 * 错误分类（取消 130 / 域错误 1 / 未知 1）与监听器清理。
 * 域知识通过 options 注入，本函数不感知任何包的错误码
 *
 * @param options - 域注入参数
 * @returns 进程外壳流程 Promise，resolve 时退出码已写入 `process.exitCode`
 */
export function runCliProcess(options: RunCliProcessOptions): Promise<void> {
  const { name, run, createCancelReason, isCancellation } = options
  const controller = new AbortController()
  const disposeSignalHandlers = registerSignalHandlers()

  return run(controller.signal)
    .then(() => {
      if (controller.signal.aborted) {
        throw controller.signal.reason
      }
    })
    .catch(error => {
      if (isCancellation(error) || controller.signal.aborted) {
        process.exitCode = 130
      } else if (error instanceof TestAppErrorLike) {
        process.exitCode = 1
        try {
          logger.error(error.message)
        } catch {
          // 日志是辅助能力，域错误仍需保持稳定退出语义
        }
      } else {
        process.exitCode = 1
        try {
          console.error(error)
        } catch {
          // 控制台异常不能让 CLI 错误处理再次失败
        }
      }
    })
    .finally(disposeSignalHandlers)

  function registerSignalHandlers(): () => void {
    let forceExitTimer: NodeJS.Timeout | undefined

    const handleSignal = (signal: NodeJS.Signals) => {
      if (!controller.signal.aborted) {
        try {
          logger.event(`Cancelling ${name} after ${signal}`)
        } catch {
          // 日志是辅助能力，不能阻止信号触发实际取消
        }
        // 即使后续只剩不持有事件循环句柄的悬空 Promise，自然退出也必须保留取消语义
        process.exitCode = 130
        controller.abort(createCancelReason(signal))
        // 第三方依赖可能忽略 AbortSignal，宽限期后退出可避免进程无限挂起
        forceExitTimer = setTimeout(
          () => process.exit(130),
          CLI_FORCE_EXIT_GRACE_PERIOD_MS,
        )
        forceExitTimer.unref()
        return
      }

      process.exit(130)
    }

    process.on('SIGINT', handleSignal)
    process.on('SIGTERM', handleSignal)

    return () => {
      if (forceExitTimer) {
        clearTimeout(forceExitTimer)
      }
      process.off('SIGINT', handleSignal)
      process.off('SIGTERM', handleSignal)
    }
  }
}
```

**关键设计决策（实现者必须注意）：** 上面代码中 `error instanceof TestAppErrorLike` 是示意。utils 无法 import 各包的 AppError（反向依赖）。真实实现用**结构化谓词**替代 instanceof：`isAppErrorLike(error)`——判断 `error instanceof Error && error.name === 'AppError'`。三个包的 AppError 构造函数都设置 `this.name = 'AppError'`（create: errors.ts:44、release: utils/error.ts:12、create-template 经 @eljs/create/errors），所以该谓词对三包成立且零依赖。实现时把 `RunCliProcessOptions` 增加一个可选成员：

```ts
  /**
   * 判定错误是否为可直接展示给用户的域错误
   *
   * @remarks
   * 缺省按 `error instanceof Error && error.name === 'AppError'` 识别
   */
  isAppError?(error: unknown): boolean
```

并把错误分类改为调用 `const appError = (options.isAppError ?? isAppErrorLike)(error)`，`isAppErrorLike` 为文件内 `@internal` 函数。这个谓词先验成立，无需在测试里 mock 三个包。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run packages/utils/__tests__/cli/run-cli-process.spec.ts`
Expected: PASS

- [ ] **Step 5: 补全信号与宽限期测试（同文件追加）**

```ts
it('首次信号取消流程并在结束后移除监听器', async () => {
  const previousListeners = new Set(process.listeners('SIGINT'))
  let signalHandler: NodeJS.SignalsListener | undefined
  const run = vi.fn().mockImplementation(async () => {
    signalHandler = process
      .listeners('SIGINT')
      .find(listener => !previousListeners.has(listener))
    ;(signalHandler as (signal: NodeJS.Signals) => void)('SIGINT')
  })

  await runHarness({ run })

  expect(signalHandler).toBeTypeOf('function')
  expect(process.exitCode).toBe(130)
  expect(process.listeners('SIGINT')).not.toContain(signalHandler)
})

it('信号日志失败时仍然取消流程', async () => {
  const previousListeners = new Set(process.listeners('SIGINT'))
  vi.spyOn(
    (await import('../../src/logger')).logger,
    'event',
  ).mockImplementationOnce(() => {
    throw new Error('Logger failed')
  })
  const run = vi.fn().mockImplementation(async () => {
    const signalHandler = process
      .listeners('SIGINT')
      .find(listener => !previousListeners.has(listener))
    ;(signalHandler as (signal: NodeJS.Signals) => void)('SIGINT')
  })

  await runHarness({ run })

  expect(process.exitCode).toBe(130)
})

it('首次信号后任务未响应时应该在宽限期结束后强制退出', async () => {
  vi.useFakeTimers()
  const previousListeners = new Set(process.listeners('SIGTERM'))
  let resolveRun: (() => void) | undefined
  let signalHandler: NodeJS.SignalsListener | undefined
  const exit = vi
    .spyOn(process, 'exit')
    .mockImplementation((() => undefined) as never)
  const run = vi.fn().mockImplementation(
    () =>
      new Promise<void>(resolve => {
        resolveRun = resolve
        signalHandler = process
          .listeners('SIGTERM')
          .find(listener => !previousListeners.has(listener))
        ;(signalHandler as (signal: NodeJS.Signals) => void)('SIGTERM')
      }),
  )

  const promise = runHarness({ run })
  await vi.waitFor(() => expect(signalHandler).toBeTypeOf('function'))
  expect(process.exitCode).toBe(130)
  await vi.advanceTimersByTimeAsync(CLI_FORCE_EXIT_GRACE_PERIOD_MS)

  expect(exit).toHaveBeenCalledWith(130)
  resolveRun?.()
  await promise
})

it('取消错误分类为 130 退出', async () => {
  const run = vi
    .fn()
    .mockRejectedValue(
      new TestAppError('Cancelled by user', 'OPERATION_CANCELLED'),
    )

  await runHarness({ run })

  expect(process.exitCode).toBe(130)
})

it('未知错误输出 console.error 且退出码为 1', async () => {
  const error = new Error('Unexpected')
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  const run = vi.fn().mockRejectedValue(error)

  await runHarness({ run })

  expect(consoleError).toHaveBeenCalledWith(error)
  expect(process.exitCode).toBe(1)
})

it('自定义 isAppError 判定优先于默认谓词', async () => {
  const error = new Error('Custom domain error')
  error.name = 'AppError'
  const run = vi.fn().mockRejectedValue(error)

  await runCliProcess({
    name: 'x',
    createCancelReason,
    isCancellation,
    isAppError: () => false,
    run,
  })

  expect(process.exitCode).toBe(1)
})
```

- [ ] **Step 6: 跑完整 utils cli 测试目录**

Run: `pnpm vitest run packages/utils/__tests__/cli`
Expected: PASS（新增文件 + 原有 index.spec.ts）

- [ ] **Step 7: 在 utils cli 子路径导出**

`packages/utils/src/cli/index.ts` 追加一行：

```ts
export * from './run-cli-process'
```

- [ ] **Step 8: 构建与类型检查**

Run: `pnpm --filter @eljs/utils build && pnpm --filter @eljs/utils typecheck`
Expected: 全部通过

- [ ] **Step 9: Commit**

```bash
git add packages/utils/src/cli packages/utils/__tests__/cli
git commit -m "feat(utils): add runCliProcess CLI process harness"
```

---

### Task 2: utils 新增 notifyUpdates（TDD）

**Files:**

- Create: `packages/utils/src/cli/notify-updates.ts`
- Modify: `packages/utils/package.json`（dependencies / peerDependencies / peerDependenciesMeta）
- Test: `packages/utils/__tests__/cli/notify-updates.spec.ts`

**Interfaces:**

- Consumes: 无（动态 import update-notifier）
- Produces:

```ts
export interface NotifyUpdatesOptions {
  /** 当前 CLI 包的 package.json 内容 */
  pkg: { name: string; version: string }
  /** Node 进程参数，用于跳过只读快路径 */
  argv: readonly string[]
  /** 调试日志函数，更新检查失败时记录原因 */
  debug?: (...args: unknown[]) => void
}

/**
 * 后台触发 CLI 更新提示……
 */
export function notifyUpdates(options: NotifyUpdatesOptions): void
```

- [ ] **Step 1: 写失败测试**

`packages/utils/__tests__/cli/notify-updates.spec.ts` 完整内容：

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { notifyUpdates } from '../../src/cli/notify-updates'

const updateNotifierMock = vi.hoisted(() => vi.fn())
const notifyMock = vi.fn()

vi.mock('update-notifier', () => ({
  default: updateNotifierMock,
}))

updateNotifierMock.mockImplementation(() => ({ notify: notifyMock }))

describe('notifyUpdates', () => {
  const pkg = { name: '@eljs/create', version: '2.0.0-beta.0' }

  beforeEach(() => {
    vi.clearAllMocks()
    updateNotifierMock.mockImplementation(() => ({ notify: notifyMock }))
  })

  it('普通命令在后台触发更新通知', async () => {
    notifyUpdates({
      pkg,
      argv: ['node', 'create', 'template', 'project'],
    })

    await vi.waitFor(() => {
      expect(updateNotifierMock).toHaveBeenCalledWith({ pkg })
      expect(notifyMock).toHaveBeenCalledOnce()
    })
  })

  it('帮助与版本查询跳过更新检查', async () => {
    for (const argument of ['-h', '--help', '-v', '--version']) {
      notifyUpdates({ pkg, argv: ['node', 'create', argument] })
    }

    // 微任务排空后仍不应加载 update-notifier
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(updateNotifierMock).not.toHaveBeenCalled()
  })

  it('加载失败时记录 debug 且不抛出', async () => {
    const debug = vi.fn()
    const error = new Error('Load failed')
    updateNotifierMock.mockImplementationOnce(() => {
      throw error
    })

    notifyUpdates({ pkg, argv: ['node', 'create', 'project'], debug })

    await vi.waitFor(() =>
      expect(debug).toHaveBeenCalledWith(
        'update notification failed:%O',
        error,
      ),
    )
  })

  it('未提供 debug 时静默吞掉更新检查失败', async () => {
    updateNotifierMock.mockImplementationOnce(() => {
      throw new Error('Load failed')
    })

    notifyUpdates({ pkg, argv: ['node', 'create', 'project'] })

    await new Promise(resolve => setTimeout(resolve, 10))
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run packages/utils/__tests__/cli/notify-updates.spec.ts`
Expected: FAIL，模块不存在

- [ ] **Step 3: 写实现**

`packages/utils/src/cli/notify-updates.ts` 完整内容：

```ts
/** 跳过更新检查的本地只读参数 */
const READ_ONLY_ARGUMENTS = ['-h', '--help', '-v', '--version'] as const

/**
 * 后台更新提示的参数
 */
export interface NotifyUpdatesOptions {
  /**
   * 当前 CLI 包的 package.json 内容
   */
  pkg: { name: string; version: string }
  /**
   * Node 进程参数，用于跳过只读快路径
   */
  argv: readonly string[]
  /**
   * 调试日志函数，更新检查失败时记录原因
   */
  debug?: (...args: unknown[]) => void
}

/**
 * 后台触发 CLI 更新提示
 *
 * @remarks
 * 更新提示是辅助能力，加载或检查失败不影响调用方主路径。
 * 帮助和版本查询是本地只读快路径，跳过网络更新提示以降低启动成本
 *
 * @param options - 更新提示参数
 */
export function notifyUpdates(options: NotifyUpdatesOptions): void {
  const { pkg, argv, debug } = options

  if (shouldCheckForUpdates(argv)) {
    // 更新提示是辅助能力，加载或检查失败不能阻止 CLI 主路径
    void import('update-notifier')
      .then(({ default: updateNotifier }) => {
        updateNotifier({ pkg }).notify()
      })
      .catch(error => {
        debug?.('update notification failed:%O', error)
      })
  }
}

/**
 * 判断当前命令是否需要检查更新
 *
 * @remarks
 * 帮助和版本查询是本地只读快路径，不应为网络更新提示增加启动成本
 *
 * @param argv - Node 进程参数
 * @returns 普通命令返回 `true`
 * @internal
 */
function shouldCheckForUpdates(argv: readonly string[]): boolean {
  return !argv.some(argument =>
    (READ_ONLY_ARGUMENTS as readonly string[]).includes(argument),
  )
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run packages/utils/__tests__/cli/notify-updates.spec.ts`
Expected: PASS

- [ ] **Step 5: 导出并声明依赖**

`packages/utils/src/cli/index.ts` 追加：

```ts
export * from './notify-updates'
```

`packages/utils/package.json`：`dependencies` 移除（若有）、`peerDependencies` 增加并配置 optional：

```json
  "peerDependencies": {
    "update-notifier": "^7.3.1"
  },
  "peerDependenciesMeta": {
    "update-notifier": {
      "optional": true
    }
  },
```

devDependencies 增加 `"@types/update-notifier": "^6.0.8"`。

- [ ] **Step 6: 安装并验证**

Run: `pnpm install && pnpm --filter @eljs/utils build && pnpm --filter @eljs/utils typecheck`
Expected: install 成功、build/typecheck 通过（动态 import optional peer 在类型上通过 `@types/update-notifier` 解析）

- [ ] **Step 7: Commit**

```bash
git add packages/utils/src/cli packages/utils/__tests__/cli packages/utils/package.json
git commit -m "feat(utils): add notifyUpdates with optional update-notifier peer"
```

---

### Task 3: 迁移 create 包

**Files:**

- Modify: `packages/create/src/cli.ts`（删除 cli/registerSignalHandlers/isCancellation/shouldCheckForUpdates/常量，改为调用共享实现）
- Modify: `packages/create/__tests__/cli.spec.ts`（无需改动即可通过；`update-notifier` 的 `vi.mock` 仍生效因为动态 import 走同一模块 ID）

**Interfaces:**

- Consumes: `runCliProcess`、`CLI_FORCE_EXIT_GRACE_PERIOD_MS`（未直接用，仅迁移语义）、`notifyUpdates`（来自 `@eljs/utils/cli`）
- Produces: `cli()` 对外签名不变（`Promise<void>`）

- [ ] **Step 1: 改写 cli.ts**

`packages/create/src/cli.ts` 新完整内容：

```ts
import { notifyUpdates, runCliProcess } from '@eljs/utils/cli'
import { readJson } from '@eljs/utils/file'
import { createDebugger } from '@eljs/utils/logger'
import type { PackageJson } from '@eljs/utils/types'
import { Command } from 'commander'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ProjectCreator } from './core'
import { AppError } from './utils'

/**
 * 启动 create 命令行程序
 *
 * @returns 命令行流程 Promise
 */
export function cli(): Promise<void> {
  return runCliProcess({
    name: 'create',
    run: main,
    createCancelReason: signal =>
      new AppError(`Create operation received ${signal}`, {
        code: 'CREATE_OPERATION_CANCELLED',
        details: { signal },
      }),
    isCancellation,
  })
}

async function main(signal: AbortSignal) {
  const debug = createDebugger('create:cli')
  const packageJsonPath =
    typeof __dirname === 'string'
      ? path.join(__dirname, '../package.json')
      : fileURLToPath(new URL('../package.json', import.meta.url))
  const pkg = await readJson<Required<PackageJson>>(packageJsonPath)

  notifyUpdates({ pkg, argv: process.argv, debug })

  const command = new Command()
    .name('create')
    .description('Generate a project from a local, npm, or Git template')
    .version(pkg.version, '-v, --version', 'Output the current version')
    .arguments('<template> <project-name>')
    .option('--cwd <cwd>', 'Specify the working directory')
    .option('-f, --force', 'Overwrite target directory if it exists')
    .option('-m, --merge', 'Merge target directory if it exists')
    .option('--no-install', 'Skip install dependencies after create done')
    .option('-y, --yes', 'Trust and execute the selected remote template')
    .option(
      '--allow-template-scripts',
      'Allow lifecycle scripts while installing remote template dependencies',
    )
    .action(async (template, projectName, options) => {
      debug?.(`template:`, template)
      debug?.(`projectName:`, projectName)
      debug?.(`options:%O`, options)
      const creatorOptions = { ...options }

      // Commander 会为否定选项注入 true 默认值，只有 false 才表示用户显式覆盖模版配置
      if (creatorOptions.install !== false) {
        delete creatorOptions.install
      }

      await new ProjectCreator({
        ...creatorOptions,
        signal,
        template,
      }).run(projectName)
    })

  command.showHelpAfterError()
  await command.parseAsync(process.argv)
}

function isCancellation(error: unknown): boolean {
  return (
    error instanceof AppError &&
    (error.code === 'CREATE_OPERATION_ABORTED' ||
      error.code === 'CREATE_OPERATION_CANCELLED')
  )
}
```

注意两点：

1. `notifyUpdates` 传 `debug`（`createDebugger` 返回的函数，可能是 undefined）——保持失败日志路径。
2. 原文件里 `logger` 导入删除（不再直接用）。

- [ ] **Step 2: 跑 create 全部测试**

Run: `pnpm vitest run packages/create/__tests__/cli.spec.ts`
Expected: PASS（现有断言 `Cancelling create after SIGINT`、`update notification failed:%O`、退出码 130 等全部由共享实现保持）

若有失败：对比失败断言与 Task 1/2 实现，修正共享实现（不是改测试断言，除非断言与设计冲突）。

- [ ] **Step 3: typecheck**

Run: `pnpm --filter @eljs/create typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/create/src/cli.ts
git commit -m "refactor(create): use shared CLI process harness and update notifier"
```

---

### Task 4: 迁移 create-template 包

**Files:**

- Modify: `packages/create-template/src/cli.ts`
- Modify: `packages/create-template/__tests__/cli.spec.ts`（预期无需改动；`vi.mock('update-notifier')` 同 Task 3 逻辑生效）

**Interfaces:**

- Consumes: 同 Task 3
- Produces: `cli()` 对外签名不变

- [ ] **Step 1: 改写 cli.ts**

`packages/create-template/src/cli.ts` 新完整内容：

```ts
import { notifyUpdates, runCliProcess } from '@eljs/utils/cli'
import { readJson } from '@eljs/utils/file'
import { createDebugger, logger } from '@eljs/utils/logger'
import type { PackageJson } from '@eljs/utils/types'
import { Command } from 'commander'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { AppError } from '@eljs/create/errors'

/**
 * 启动 create-template 命令行程序
 *
 * @returns 命令行流程 Promise
 */
export async function cli(): Promise<void> {
  return runCliProcess({
    name: 'create-template',
    run: main,
    createCancelReason: signal =>
      new AppError(`Create template operation received ${signal}`, {
        code: 'CREATE_OPERATION_CANCELLED',
        details: { signal },
      }),
    isCancellation,
  })
}

async function main(signal: AbortSignal) {
  const debug = createDebugger('create-template:cli')
  const packageJsonPath =
    typeof __dirname === 'string'
      ? path.join(__dirname, '../package.json')
      : fileURLToPath(new URL('../package.json', import.meta.url))
  const pkg = await readJson<Required<PackageJson>>(packageJsonPath)

  notifyUpdates({ pkg, argv: process.argv, debug })

  const command = new Command()
    .name('create-template')
    .description('Initialize a project from an official template')
    .version(pkg.version, '-v, --version', 'Output the current version')
    .argument('<project-name>', 'Project name')
    .option('--cwd <cwd>', 'Specify the working directory')
    .option('-t, --template <template>', 'Specify an application template')
    .option('-f, --force', 'Overwrite target directory if it exists')
    .option('-m, --merge', 'Merge target directory if it exists')
    .option(
      '--allow-template-scripts',
      'Allow lifecycle scripts while installing template dependencies',
    )
    .action(async (projectName, options) => {
      debug?.(`projectName:`, projectName)
      debug?.(`options:%O`, options)
      const { CreateTemplate } = await import('./create')
      await new CreateTemplate({ ...options, signal }).run(projectName)
    })
    .showHelpAfterError()

  await command.parseAsync(process.argv)
}

function isCancellation(error: unknown): boolean {
  return (
    error instanceof AppError &&
    (error.code === 'CREATE_OPERATION_ABORTED' ||
      error.code === 'CREATE_OPERATION_CANCELLED')
  )
}
```

注意：`createCancelReason` 用 `CREATE_OPERATION_CANCELLED`（与原文件一致，共享 @eljs/create 的错误码）。原文件导入了 `logger` 但新内容只在 signal handlers 里用过它——新文件里删除 `logger` 导入（如上，只保留 `createDebugger`）。上面 import 行保留了 `logger` 是笔误，实现时删除。

- [ ] **Step 2: 跑测试**

Run: `pnpm vitest run packages/create-template/__tests__/cli.spec.ts`
Expected: PASS（断言 `Cancelling create template after SIGINT` 等保持）

- [ ] **Step 3: typecheck**

Run: `pnpm --filter create-template typecheck`（按 package.json 实际 filter 名执行，见 package.json `name` 字段——`@eljs/create-template`）
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/create-template/src/cli.ts
git commit -m "refactor(create-template): use shared CLI process harness and update notifier"
```

---

### Task 5: 迁移 release 包（含行为修复）

**Files:**

- Modify: `packages/release/src/cli.ts`
- Modify: `packages/release/__tests__/cli.spec.ts`

**Interfaces:**

- Consumes: 同 Task 3
- Produces: `cli()` 对外签名不变

**本任务包含两处设计批准的行为修复：**

1. 更新提示：静态 import → `notifyUpdates`（跳过只读命令、动态加载、失败兜底）
2. 取消分类：`controller.signal.aborted` 判定时补上 `isCancellation` 分支（release 的 AppError 无 code 字段，`isCancellation` 直接返回 `false`；分支保留以对齐外壳语义，若未来 release 引入取消码即自动生效）

- [ ] **Step 1: 改写 cli.ts**

`packages/release/src/cli.ts` diff 语义（保留 checkVersion/parsePositiveInteger/parseOptions/NestedObject/isNestedObject 不动，仅替换头部与 main）：

删除：`import updateNotifier from 'update-notifier'`、`FORCE_EXIT_GRACE_PERIOD_MS`、`registerSignalHandlers`、原 `cli()` 外壳。

新头部与 `cli()`：

```ts
import { notifyUpdates, runCliProcess } from '@eljs/utils/cli'
import { readJson } from '@eljs/utils/file'
import { createDebugger } from '@eljs/utils/logger'
import type { PackageJson } from '@eljs/utils/types'
import { InvalidArgumentError, program } from 'commander'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import semver, { type ReleaseType } from 'semver'

import { release } from './release'
import { AppError } from './utils'

const { RELEASE_TYPES } = semver

/**
 * 启动 release 命令行程序
 *
 * @returns 命令行流程 Promise
 */
export function cli(): Promise<void> {
  return runCliProcess({
    name: 'release',
    run: main,
    createCancelReason: signal =>
      new AppError(`Release operation received ${signal}`),
    isCancellation: () => false,
  })
}

async function main(signal: AbortSignal) {
  const debug = createDebugger('release:cli')
  const packageJsonPath =
    typeof __dirname === 'string'
      ? path.join(__dirname, '../package.json')
      : fileURLToPath(new URL('../package.json', import.meta.url))

  const pkg = await readJson<Required<PackageJson>>(packageJsonPath)

  notifyUpdates({ pkg, argv: process.argv, debug })

  program
    .name('eljs-release')
    .description('Run a programmable npm release workflow')
    .version(pkg.version, '-v, --version', 'Output the current version')
    .argument('[version]', 'Specify the bump version', checkVersion)
    // ……以下 option/parseOptions/action 链与原文件逐行一致，不动……
```

action 末尾保持 `await release(version, { ...options, signal })`。`isCancellation: () => false` 处加一行中文注释：`// release 的 AppError 尚无取消错误码，保留接口对齐以备未来接入`。

- [ ] **Step 2: 跑测试并按需修复测试**

Run: `pnpm vitest run packages/release/__tests__/cli.spec.ts`
Expected: 多数 PASS。已知必改点：

a. 原 149/409/493/712 行的 `expect(updateNotifier).toHaveBeenCalledWith({ pkg: mockPackageJson })` 现在是异步动态 import，改为：

```ts
await vi.waitFor(() =>
  expect(updateNotifier).toHaveBeenCalledWith({ pkg: mockPackageJson }),
)
```

b. 第 406 行 `'应该调用 updateNotifier 并触发通知'` 整个测试改为异步等待版本：

```ts
it('应该调用 updateNotifier 并触发通知', async () => {
  await cli()

  await vi.waitFor(() =>
    expect(updateNotifier).toHaveBeenCalledWith({ pkg: mockPackageJson }),
  )

  const notifierResult = (
    updateNotifier as MockedFunction<typeof updateNotifier>
  ).mock.results[0]
  if (notifierResult && notifierResult.value) {
    expect(notifierResult.value.notify).toHaveBeenCalled()
  }
})
```

c. 测试文件的 `vi.mock('@eljs/utils', () => ({...}))` 工厂只提供了 `chalk/createDebugger/readJson`，而新 cli.ts 还从 `@eljs/utils/cli` 导入 `notifyUpdates/runCliProcess`。必须在 mock 工厂中补上（用 vi.hoisted 提供实现）：

```ts
const { mockRunCliProcess, mockNotifyUpdates } = vi.hoisted(() => ({
  mockRunCliProcess: vi.fn(),
  mockNotifyUpdates: vi.fn(),
}))

vi.mock('@eljs/utils', () => ({
  chalk: { ... },
  createDebugger: vi.fn(() => vi.fn()),
  readJson: vi.fn(),
}))

vi.mock('@eljs/utils/cli', () => ({
  runCliProcess: mockRunCliProcess,
  notifyUpdates: mockNotifyUpdates,
}))
```

`runCliProcess` mock 需要**真实行为**以保住信号测试（331-393 行）。方案：`mockRunCliProcess.mockImplementation` 委托给真实模块。在 describe 外添加：

```ts
// 信号语义由共享外壳保证，这里直接复用真实实现保持测试效力
const { runCliProcess: realRunCliProcess } = await import('@eljs/utils/cli')
mockRunCliProcess.mockImplementation(
  (options: Parameters<typeof realRunCliProcess>[0]) =>
    realRunCliProcess(options),
)
```

**注意**：这段顶层 await 在 vitest 里依赖 ESM 顶层 await 支持，可行；若与 `vi.mock('@eljs/utils/cli')` 的模块拦截冲突（import 的也是 mock），改用 `vi.importActual`：

```ts
const { runCliProcess: realRunCliProcess } =
  await vi.importActual('@eljs/utils/cli')
```

执行时优先用 `vi.importActual` 方案，避免任何拦截歧义。

d. `import updateNotifier from 'update-notifier'` 与 `vi.mock('update-notifier')` 保留在测试文件（notifyUpdates 内部动态 import 走同一模块 ID 被拦截）。

- [ ] **Step 3: 跑全量 release 测试**

Run: `pnpm vitest run packages/release/__tests__`
Expected: PASS

- [ ] **Step 4: typecheck**

Run: `pnpm --filter @eljs/release typecheck`
Expected: PASS

- ] **Step 5: Commit**

```bash
git add packages/release/src/cli.ts packages/release/__tests__/cli.spec.ts
git commit -m "refactor(release): use shared CLI harness and fix update notifier behavior"
```

---

### Task 6: 全仓库验证与收尾

**Files:**

- Modify（如本任务内发现）: 上述所有文件

- [ ] **Step 1: 构建所有受影响包**

Run: `pnpm --filter @eljs/utils --filter @eljs/create --filter @eljs/create-template --filter @eljs/release build`
Expected: 全部成功

- [ ] **Step 2: 全量测试**

Run: `pnpm test`
Expected: 全部 PASS

- [ ] **Step 3: 全量 lint**

Run: `pnpm lint`
Expected: 0 error 0 warning

- [ ] **Step 4: 全量 typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 5: 复查新增导出的 TSDoc 与 diff**

检查：

- `runCliProcess` / `notifyUpdates` / 两个 options 接口的 TSDoc 覆盖 `@param`/`@returns`/`@remarks`（中文、无句号结尾）
- `packages/utils/README.md` 的 API 列表是否需要补 `runCliProcess`/`notifyUpdates`（查看现有 README 中 pause/confirm 等的列法，若有 API 表格则补两行；无则跳过）
- diff 中无多余注释、无残留 `FORCE_EXIT_GRACE_PERIOD_MS` 常量副本

- [ ] **Step 6: Commit（如有 README 或遗漏修复）**

```bash
git add -A
git commit -m "docs(utils): document runCliProcess and notifyUpdates"
```

---

## Self-Review 结论

- **Spec 覆盖**：方案 A 的两个导出（runCliProcess、notifyUpdates）、optional peerDependency、三包迁移、release 行为修复（跳过只读命令/动态 import/失败兜底/取消分类）、日志模板统一——分别由 Task 1/2/3/4/5 覆盖 ✓
- **占位符扫描**：Task 5 的 "……以下 option 链与原文件逐行一致，不动……" 是指向现有代码的明确指令而非 TBD；无其他占位 ✓
- **类型一致性**：`RunCliProcessOptions`（name/run/createCancelReason/isCancellation/isAppError?）与 `NotifyUpdatesOptions`（pkg/argv/debug?）在 Task 1/2 定义、Task 3/4/5 消费处签名一致 ✓
