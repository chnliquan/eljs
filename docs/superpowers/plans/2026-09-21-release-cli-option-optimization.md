# Release CLI Option 优化（value-source 优先级 + 双向开关）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 commander value-source 驱动 CLI 选项解析，修正"配置文件压过显式 CLI"的优先级反转，为可双向覆盖的 boolean 补齐正形式，并加真实 commander 集成测试与解析层参数校验。

**Architecture:** `main()` 重构为：读 package.json → `createProgram(version, hooks)` 构建独立 `new Command()` 实例（不再用 commander 全局单例，消除重复注册冲突）→ `parseAsync(process.argv)`。boolean 成对声明 `--X`（显式默认值）+ `--no-X`；action 第三参拿 `Command` 实例，`parseOptions` 只透传 `getOptionValueSource(key) === 'cli'` 的键，点分递归展开后传 `release()`。未显式传递的键不进入 `releaseOptions`，`deepMerge(default, userConfig, releaseOptions)` 合并链不变。`--github.mode` 用 `Option.choices`、`--npm.prereleaseId` 用 argParser 在解析层报错。

**Tech Stack:** TypeScript、commander v14.0.3、vitest（root vitest.config.ts，pool=forks）、pnpm monorepo（turbo）。

**Spec:** 本计划自身即 spec（源自本会话对 `packages/release/src/cli.ts`、`__tests__/cli.spec.ts`、`src/types/config.ts`、`src/internal/config.ts`、`README.md` 的完整 review 与 6 轮 commander 探针验证，无独立 spec 文件）。

## Global Constraints

- 仓库规则：TSDoc 用中文、不加与标识符/类型同义的注释、公开 API 需 TSDoc、`@internal` 标注包内边界；收尾跑根 `pnpm typecheck && pnpm lint && pnpm test`
- 测试命令在仓库根执行：`pnpm vitest run packages/release/__tests__/<spec>.ts`（vitest.config.ts root 指向仓库根，别名 `@eljs/*` 映射 `packages/*/src`）
- **commander v14.0.3 探针结论（6 轮真实探针，执行时勿凭记忆推翻；复验方式：写临时 .mjs 到 `packages/release/` 跑完即删）**：
  1. 成对声明 `option('--X', desc, true)` + `option('--no-X', desc)` 合法；`--X`/`--no-X` 均可传，last-one-wins；未传时 `opts[X] === true`、source `'default'`；传了是 `'cli'`
  2. 同一实例重复注册同一 flag 抛 `Cannot add option ... conflicting flag`——全局 `program` 单例上 `cli()` 两次会炸（真实环境）；mock 环境无此问题（mock.option 只记录）
  3. `--github.mode` choices 必须 `addOption(new Option(flags, desc).choices([...]).default('browser'))`：`.option()` 无第 5 参；非法值 stderr 报 `error: option '--github.mode <mode>' argument 'gitlab' is invalid. Allowed choices are browser, api.`，action 不执行，`_exit(1)`
  4. argParser 抛 `InvalidArgumentError` 被 commander 包装为 `error: option '--npm.prereleaseId <id>' argument '1.2.3' is invalid. <自定义消息>`；action 不执行
  5. 未传值选项：opts 无键、source `undefined`；未传带默认值选项（`'browser'`）：opts **有**键但 source `'default'`——过滤必须以 source 为准
  6. 点分 attributeName 原样保留（`'git.push'`）；negation-only 未传：`opts['git.changelog'] === true`、source `'default'`
  7. vitest 下 mock `process.exit`：commander 错误路径（unknown option / choices / argParser 报错）→ `parseAsync` **rejection**；choices 错误的 rejection message 是 `'Allowed choices are browser, api.'`（**不含**用户输入值 `gitlab`）；unknown option 的 rejection message 形如 `REAL_EXIT...` 取决于 exit mock 实现，用 `rejects.toThrow()` 泛断言
- **行为变更清单（交付语义）**：
  1. `--git.push`/`--git.commit`/`--git.requireClean`/`--npm.requireOwner`/`--npm.confirm`/`--github.release` 正形式合法化，显式传递可覆盖配置文件的 `false`
  2. `--git.independent`/`--npm.prerelease`/`--npm.canary` 增加 `--no-` 关闭形态
  3. `--git.changelog` **保持 negation-only**（Config 类型 `false | object`，正形式 `true` 是非法配置）
  4. `--github.mode`/`--npm.prereleaseId` 非法值在解析层报错（后者校验规则与 `src/internal/config.ts:47-57` 同源：`/^[0-9A-Za-z-]+$/`、非 `latest`、非 semver range）
  5. 真实 commander 下未声明点分键（如 `git.changelog.filename`）是 unknown option，不可能出现——旧 cli.spec.ts 中此类用例改写为 parseOptions 递归展开的单元级测试
- **环境事实**：`rslib.base.config.ts` 入口 `./src/**` 全量，`createProgram` 会进 dist，无需改构建配置；bin 入口 `bin/release.js` 只 import `cli`，不受影响；`dist/` 被 gitignore，不提交；`packages/*/src/**/cli.ts` 在 coverage 排除列表（vitest.config.ts:43），新增 spec 不影响覆盖率阈值
- `signal`：action 里 `release(version, { ...options, signal: hooks.signal })`，`hooks.signal` 由 `main` 从 `runCliProcess` 注入；`Config.signal` 本身 optional
- `.vscode/launch.json:53` 的 `"// --git.independent"` 是注释掉的调试配置，不动

---

### Task 1: 真实 commander 冒烟 spec（TDD 红灯）

**Files:**

- Create: `packages/release/__tests__/cli-commander.spec.ts`

**Interfaces:**

- Consumes: `../src/cli` 的 `createProgram`（本 task 时不存在——import 失败即红灯形态）
- Produces: 9 个断言新行为契约的用例；Task 2 完成后必须全绿

- [ ] **Step 1: 写冒烟 spec**

创建 `packages/release/__tests__/cli-commander.spec.ts`，完整内容：

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * @file 真实 commander 解析链路的集成冒烟测试
 * @description 不 mock commander 解析行为，验证点分选项、否定前缀、
 * value-source 过滤与解析层参数校验的真实语义
 */

vi.mock('update-notifier', () => ({ default: vi.fn() }))
vi.mock('../src/release', () => ({ release: vi.fn() }))
vi.mock('../src/utils', () => ({
  AppError: class AppError extends Error {},
}))

import type { MockedFunction } from 'vitest'
import { createProgram } from '../src/cli'
import { release } from '../src/release'

const runCommand = async (args: string[]): Promise<void> => {
  const exit = vi
    .spyOn(process, 'exit')
    .mockImplementation((() => undefined) as never)
  try {
    await createProgram('1.0.0').parseAsync(['node', 'release', ...args])
  } finally {
    exit.mockRestore()
  }
}

const capturedOptions = (): Record<string, unknown> | undefined =>
  (release as MockedFunction<typeof release>).mock.calls[0]?.[1] as
    Record<string, unknown> | undefined

describe('真实 commander 解析链路', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.exitCode = undefined
  })

  it('未传 flag 时不向 release 传递任何 git/npm/github 键', async () => {
    await runCommand(['minor'])
    const options = capturedOptions()
    expect(options).not.toHaveProperty('git')
    expect(options).not.toHaveProperty('npm')
    expect(options).not.toHaveProperty('github')
  })

  it('否定 flag 递归展开到嵌套路径', async () => {
    await runCommand(['--no-git.push'])
    expect(capturedOptions()?.git).toEqual({ push: false })
  })

  it('正形式 --git.push 显式传递 true', async () => {
    await runCommand(['--git.push'])
    expect(capturedOptions()?.git).toEqual({ push: true })
  })

  it('--no-npm.canary 关闭 canary', async () => {
    await runCommand(['--no-npm.canary'])
    expect(capturedOptions()?.npm).toEqual({ canary: false })
  })

  it('--no-git.independent 关闭独立标签', async () => {
    await runCommand(['--no-git.independent'])
    expect(capturedOptions()?.git).toEqual({ independent: false })
  })

  it('值选项传递字符串', async () => {
    await runCommand(['--npm.registry', 'https://registry.example.com'])
    expect(capturedOptions()?.npm).toEqual({
      registry: 'https://registry.example.com',
    })
  })

  it('同键正反形式 last-one-wins', async () => {
    await runCommand(['--no-git.push', '--git.push'])
    expect(capturedOptions()?.git).toEqual({ push: true })
  })

  it('--github.mode 非法值在解析层报错且不调用 release', async () => {
    await expect(runCommand(['--github.mode', 'gitlab'])).rejects.toThrow()
    expect(release).not.toHaveBeenCalled()
  })

  it('--npm.prereleaseId 非法值在解析层报错且不调用 release', async () => {
    await expect(runCommand(['--npm.prereleaseId', '1.2.3'])).rejects.toThrow()
    expect(release).not.toHaveBeenCalled()
  })
})
```

要点（全部探针已验证）：

- 不 mock commander，`createProgram('1.0.0')` 每用例 fresh 实例，天然避开全局单例重复注册
- mock `process.exit` 后 commander 错误路径是 `parseAsync` rejection（探针 7）
- `createDebugger` 不 mock（真实实现 DEBUG 未设时返回 undefined，action 里 `hooks.debug?.()` 安全）；`createProgram('1.0.0')` 不读 package.json（读文件在 `main` 里，测试不调 `main`），无需 mock `readJson`
- choices/argParser 错误的 rejection message 不含用户值（探针 3），用泛 `rejects.toThrow()` 断言

- [ ] **Step 2: 确认红灯**

Run: `pnpm vitest run packages/release/__tests__/cli-commander.spec.ts`
Expected: FAIL——`createProgram` 未导出，import 报错，整个 spec 无法收集。这是预期红灯形态

- [ ] **Step 3: Commit**

```bash
git add packages/release/__tests__/cli-commander.spec.ts
git commit -m "test(release): 添加真实 commander 解析链路冒烟测试"
```

---

### Task 2: cli.ts 重构——createProgram 抽取 + 成对声明 + value-source 解析 + 解析层校验

**Files:**

- Modify: `packages/release/src/cli.ts`（全文件重写；原 `program` 全局单例、三段删除名单、`isNestedObject` 全部移除）

**Interfaces:**

- Consumes: Task 1 spec（验收标准）
- Produces:
  - `createProgram(version: string, hooks?: { signal?: AbortSignal; debug?: (formatter: string, ...args: unknown[]) => void }): Command`（导出、`@internal` TSDoc，Task 1 spec 与 main 消费）
  - `checkPrereleaseId(value: string): string`（模块私有 argParser）

- [ ] **Step 1: 重写 cli.ts**

完整文件内容：

```typescript
import { notifyUpdates, runCliProcess } from '@eljs/utils/cli'
import { readJson } from '@eljs/utils/file'
import { createDebugger } from '@eljs/utils/logger'
import type { PackageJson } from '@eljs/utils/types'
import { Command, InvalidArgumentError, Option } from 'commander'
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
    // release 的 AppError 尚无取消错误码，保留接口对齐以备未来接入
    isCancellation: () => false,
  })
}

/**
 * 构建已注册全部选项的 release 命令实例
 *
 * @remarks
 * 每次调用返回独立 commander 实例，主入口与集成测试复用同一套声明；
 * boolean 选项成对声明正反形式，未显式传递的值由 value-source 过滤，
 * 不会进入发布配置，因此 CLI 显式值始终优先于配置文件
 *
 * @param version - CLI 自身版本号
 * @param hooks - 主入口注入的信号与调试日志
 * @returns 已注册选项的 commander 实例
 *
 * @internal
 */
export function createProgram(
  version: string,
  hooks: {
    signal?: AbortSignal
    debug?: (formatter: string, ...args: unknown[]) => void
  } = {},
): Command {
  const program = new Command()

  program
    .name('release')
    .description('Run a programmable npm release workflow')
    .version(version, '-v, --version', 'Output the current version')
    .argument('[version]', 'Specify the bump version', checkVersion)
    .option('--cwd <cwd>', 'Specify the working directory')
    .option(
      '--dry-run',
      'Validate and preview without publishing or modifying project files',
    )
    .option('--retry', 'Retry the release version from the release tag at HEAD')
    .option(
      '--git.independent',
      'Generate one git tag per workspace package',
      false,
    )
    .option('--no-git.independent', 'Generate a single git tag')
    .option('--git.requireClean', 'Check git working tree is clean', true)
    .option('--no-git.requireClean', 'Skip git working tree clean check')
    .option('--git.commit', 'Commit version and changelog changes', true)
    .option('--no-git.commit', 'Skip git commit')
    .option('--git.push', 'Push commit and tags to remote', true)
    .option('--no-git.push', 'Skip git push')
    .option(
      '--git.requireBranch <branch>',
      'Require that the release is on a particular branch',
    )
    .option('--npm.prerelease', 'Specify the release type as prerelease', false)
    .option('--no-npm.prerelease', 'Release a stable version')
    .option('--npm.canary', 'Specify the release type as canary', false)
    .option('--no-npm.canary', 'Disable canary release')
    .option('--npm.registry <registry>', 'Specify the npm registry')
    .option('--npm.requireOwner', 'Require npm ownership of all packages', true)
    .option('--no-npm.requireOwner', 'Skip npm owner check')
    .option('--npm.confirm', 'Confirm bump version before publish', true)
    .option('--no-npm.confirm', 'Skip confirm bump version')
    .option(
      '--npm.prereleaseId <prereleaseId>',
      'Specify the prereleaseId',
      checkPrereleaseId,
    )
    .option('--github.release', 'Create GitHub Release', true)
    .option('--no-github.release', 'Skip GitHub release')
    .addOption(
      new Option(
        '--github.mode <mode>',
        'Create GitHub releases through browser or api',
      )
        .choices(['browser', 'api'])
        .default('browser'),
    )
    .showHelpAfterError()
    .action(async (version, opts, command) => {
      hooks.debug?.(`version:`, version)
      hooks.debug?.(`opts:%O`, opts)
      // retry 的目标版本只能由本地发布标签决定，显式版本与自动发现互相矛盾
      if (version && opts.retry) {
        throw new InvalidArgumentError(
          '--retry cannot be combined with a version argument',
        )
      }
      const options = parseOptions(opts, command)
      hooks.debug?.(`options:%O`, options)
      await release(version, { ...options, signal: hooks.signal })
    })

  return program
}

async function main(signal: AbortSignal) {
  const debug = createDebugger('release:cli')
  const packageJsonPath =
    typeof __dirname === 'string'
      ? path.join(__dirname, '../package.json')
      : fileURLToPath(new URL('../package.json', import.meta.url))

  const pkg = await readJson<Required<PackageJson>>(packageJsonPath)

  notifyUpdates({ pkg, argv: process.argv, debug })
  await createProgram(pkg.version, { signal, debug }).parseAsync(process.argv)
}

function checkVersion(value: string): string {
  if (RELEASE_TYPES.includes(value as ReleaseType)) {
    return value
  }

  if (!semver.valid(value)) {
    throw new InvalidArgumentError(`Invalid semantic version \`${value}\`.`)
  }

  // if startsWith 'v', need to remove it
  if (value.indexOf('v') === 0) {
    return value.substring(1)
  }

  return value
}

function checkPrereleaseId(value: string): string {
  if (
    !/^[0-9A-Za-z-]+$/.test(value) ||
    value === 'latest' ||
    Boolean(semver.validRange(value))
  ) {
    throw new InvalidArgumentError(
      `Expected a single non-numeric prerelease identifier that is safe as an npm dist-tag.`,
    )
  }
  return value
}

/**
 * CLI 点分路径选项解析期间使用的递归对象容器
 *
 * @internal
 */
type NestedObject = Record<string, unknown>

/**
 * 收集 commander 解析后 source 为显式传递的选项键
 *
 * @param command - 已完成解析的命令实例
 * @returns source 为 cli 或 env 的点分选项键集合
 */
function collectExplicitKeys(
  command: Pick<Command, 'options' | 'getOptionValueSource'>,
): Set<string> {
  const explicitKeys = new Set<string>()

  for (const option of command.options) {
    const attributeName = option.attributeName()
    if (explicitKeys.has(attributeName)) {
      continue
    }
    const source = command.getOptionValueSource(attributeName)
    if (source === 'cli' || source === 'env') {
      explicitKeys.add(attributeName)
    }
  }

  return explicitKeys
}

/**
 * 将点分选项键递归展开为嵌套配置对象
 *
 * @param options - commander 解析得到的平铺选项
 * @param command - 已完成解析的命令实例，用于过滤默认注入值
 * @returns 仅包含 CLI 显式传递值的嵌套配置
 */
function parseOptions(
  options: Record<string, unknown>,
  command: Pick<Command, 'options' | 'getOptionValueSource'>,
): NestedObject {
  const result: NestedObject = {}
  const explicitKeys = collectExplicitKeys(command)

  for (const [path, value] of Object.entries(options)) {
    if (!explicitKeys.has(path)) {
      continue
    }

    if (!path.includes('.')) {
      result[path] = value
      continue
    }

    const keys = path.split('.').filter(Boolean)
    let current = result

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      if (i === keys.length - 1) {
        current[key] = value
      } else {
        current[key] = current[key] || {}
        current = current[key] as NestedObject
      }
    }
  }

  return result
}
```

要点（全部探针已验证）：

- import 里 `Command` 是值+类型一体（`new Command()` 与返回类型注解）
- 不再 import 全局 `program`；`showHelpAfterError()` 已在链式声明中（`.addOption(...)` 与 `.action(...)` 之间）
- `--git.changelog` 保持 negation-only（探针结论 6：negation-only 未传时 `opts['git.changelog'] === true`、source `'default'`，被 source 过滤拦下，不会误入配置）
- `--github.mode` 声明用 `addOption`；原 `.option('--github.mode <mode>', ...)` 删除
- `parseOptions` 必传 `command`（不再有可选分支）；action 内调试日志经 `hooks.debug?.(...)`

- [ ] **Step 2: 类型检查**

Run: `cd packages/release && pnpm typecheck`
Expected: PASS

- [ ] **Step 2b: 跑冒烟 spec（绿灯）**

Run: `pnpm vitest run packages/release/__tests__/cli-commander.spec.ts`（仓库根执行）
Expected: PASS 全部 9 个用例

- [ ] **Step 3: 跑原 cli.spec.ts 确认损坏面**

Run: `pnpm vitest run packages/release/__tests__/cli.spec.ts`
Expected: FAIL——mock 段与新实现不匹配（cli.ts 不再 import 全局 `program`，mock 的 `Command` 未提供）。此步只确认 FAIL 范围，Task 3 处理

- [ ] **Step 4: Commit**

```bash
git add packages/release/src/cli.ts
git commit -m "refactor(release): CLI 选项 value-source 解析与成对 boolean 声明"
```

---

### Task 3: cli.spec.ts 单元测试改写

**Files:**

- Modify: `packages/release/__tests__/cli.spec.ts`（mock 段 25-105、用例 316-736）

**Interfaces:**

- Consumes: Task 2 的 `createProgram(version, hooks)`、action 三参签名 `(version, opts, command)`
- Produces: 与新实现一致的单元测试

- [ ] **Step 1: 改写 commander mock 段**

原 66-69 行 `vi.mock('commander', ...)` 替换为：

```typescript
const { mockProgram } = vi.hoisted(() => ({
  mockProgram: {
    name: vi.fn().mockReturnThis(),
    description: vi.fn().mockReturnThis(),
    version: vi.fn().mockReturnThis(),
    argument: vi.fn().mockReturnThis(),
    option: vi.fn().mockReturnThis(),
    addOption: vi.fn().mockReturnThis(),
    action: vi.fn().mockReturnThis(),
    showHelpAfterError: vi.fn().mockReturnThis(),
    parseAsync: vi.fn().mockResolvedValue(undefined),
    outputHelp: vi.fn(),
    options: [] as Array<{ attributeName: () => string }>,
    getOptionValueSource: vi.fn((key: string) => 'cli' as const),
  },
}))

vi.mock('commander', () => ({
  InvalidArgumentError: class InvalidArgumentError extends Error {},
  Option: class Option {
    constructor(
      public flags: string,
      public description?: string,
    ) {}
    choices() {
      return this
    }
    default() {
      return this
    }
  },
  Command: class Command {
    constructor() {
      return mockProgram
    }
  },
}))
```

要点：

- `Command` mock 为"构造即返回 mockProgram"，`createProgram` 内 `new Command()` 拿到 mockProgram，链式 vi.fn 全部 returnThis
- mockProgram 携带 `options` 数组与 `getOptionValueSource` 供测试注入 source 场景
- `beforeEach` 里必须重置 `mockProgram.options = []`（vi.clearAllMocks 不清数组内容）

- [ ] **Step 2: 改写受影响用例**

改写清单（行号对应当前文件）：

1. **`应该设置基本命令行选项`（196-228）**：断言集更新。新增断言：
   `expect(mockProgram.option).toHaveBeenCalledWith('--git.push', 'Push commit and tags to remote', true)`、
   `expect(mockProgram.option).toHaveBeenCalledWith('--git.independent', 'Generate one git tag per workspace package', false)`、
   `expect(mockProgram.option).toHaveBeenCalledWith('--no-git.independent', 'Generate a single git tag')`、
   `expect(mockProgram.addOption).toHaveBeenCalledTimes(1)`（github.mode 走 addOption）
2. **`应该正确解析嵌套选项`（316-339）**：action 调用改为 `actionHandler('minor', {...}, mockProgram)`（mockProgram 的 source 全 'cli'，全透传）。断言 `github: {}` 不变——新声明 `--github.mode` 未传时 opts 有 `'github.mode': 'browser'` 但 mock 下我们直接构造 opts 对象，此用例输入里没传它，断言 `github: {}` 仍成立
3. **`应该删除默认 true 值的特定选项`（341-362）**：改名为 `应该过滤 source 为 default 的选项`。配置：
   `mockProgram.options = [{ attributeName: () => 'git.independent' }, { attributeName: () => 'git.requireClean' }, { attributeName: () => 'git.commit' }, { attributeName: () => 'npm.confirm' }, { attributeName: () => 'github.release' }]`，
   `mockProgram.getOptionValueSource.mockImplementation(key => (key === 'git.independent' ? 'cli' : 'default'))`。
   传 `{'git.requireClean': true, 'git.commit': true, 'npm.confirm': true, 'github.release': true, 'git.independent': true}`，断言 `options?.git` 只含 `independent: true`、`npm` 为 `{}`、`github` 为 `{}`
4. **`应该处理复杂的选项键路径`（470-491）**：改为 parseOptions 递归展开单元测试：`mockProgram.options` 置为输入键的 attributeName 集合、source 全 'cli'，输入 `{'git.changelog.filename': 'CHANGES.md', 'git.changelog.preset': 'angular', 'npm.publishArgs': '--access public'}`，断言 `git.changelog` 为 `{ filename: 'CHANGES.md', preset: 'angular' }`、`npm.publishArgs` 为 `'--access public'`。真实 unknown-option 路径由冒烟 spec 守护
5. **`应该处理空选项对象`（493-501）**：调用补第三参 `mockProgram`；断言删掉 `signal: expect.any(AbortSignal)`（直接调用 action 时 signal 是 undefined），改为 `expect(release).toHaveBeenCalledWith('major', expect.objectContaining({}))` 或删除该用例改测"空 opts + source 过滤后无残留"
6. **`应该处理混合的平级和嵌套选项`（503-524）**：补第三参 `mockProgram`，断言不变
7. **`CLI 完整集成测试`（678-736）**：`'git.changelog': true`、`'npm.prerelease': false` 输入改为合法键集；`options?.git`/`npm` 断言改为"source default 的键被过滤"（同要点 3 手法）
8. **`信号处理验证`（373-434）**：`cli()` → `main` → `createProgram(...).parseAsync(process.argv)`，mockProgram.parseAsync 是 vi.fn 拦截点不变，通过
9. **`应该设置所有选项数量`（540）**：`toBeGreaterThanOrEqual(13)` 改为 `toBeGreaterThanOrEqual(18)`（成对声明后 .option 调用约 20 次 + addOption 1 次；写宽松下限 18，以实际为准）
10. **`重复调用 CLI`（745-754）**：mock 下 `new Command()` 每次返回同一 mockProgram，mock.option 只是记录调用不冲突，通过。**但真实环境 `main` 两次调用会各自 new Command，无全局单例问题**——探针 2 的重复注册炸点在"同一实例"，新架构天然规避
11. **新增 checkPrereleaseId 校验用例**：`const optionCall = mockProgram.option.mock.calls.find(c => Array.isArray(c) && c[0]?.includes('prereleaseId'))`，`const checkPrereleaseId = optionCall[3]`，断言：`'alpha'` 返回 `'alpha'`；`'1.2.3'`/`'latest'`/`'alpha.1'` 各自 throw InvalidArgumentError
12. **action 测试通用**：所有 `actionHandler(version, opts)` 两参调用改三参 `actionHandler(version, opts, mockProgram)`（mockProgram 默认 source 'cli' 全透传）或显式构造 source 场景的 mock
13. **`应该正确调用 release 函数`（286-295）**：actionHandler 调用补 `mockProgram`；`release` 断言中 `cwd: '/it'` 不变

- [ ] **Step 3: 跑改写后 cli.spec.ts**

Run: `pnpm vitest run packages/release/__tests__/cli.spec.ts`
Expected: PASS 全部用例

- [ ] **Step 4: Commit**

```bash
git add packages/release/__tests__/cli.spec.ts
git commit -m "test(release): 改写 CLI 单元测试适配 value-source 过滤"
```

---

### Task 4: README 文档更新

**Files:**

- Modify: `packages/release/README.md:106-150`（Options 表 + Precedence 小节 + CLI Examples）

**Interfaces:**

- Consumes: Task 2 的新声明集（flag 名、默认值、文案）
- Produces: 与实现一致的公开文档

- [ ] **Step 1: 替换 Options 表**

README.md Options 表（约 108-128 行）替换为（对齐以渲染为准，列结构三列不变）：

```markdown
| Option                                         | Description                                             | Default            |
| ---------------------------------------------- | ------------------------------------------------------- | ------------------ |
| `-v, --version`                                | Output the current version                              | -                  |
| `--cwd <cwd>`                                  | Specify the working directory                           | `process.cwd()`    |
| `--dry-run`                                    | Preview without publishing or modifying project files   | `false`            |
| `--git.independent` / `--no-git.independent`   | Generate one git tag per workspace package              | `false`            |
| `--git.requireClean` / `--no-git.requireClean` | Check git working tree is clean                         | `true`             |
| `--no-git.changelog`                           | Skip changelog generation                               | `true`             |
| `--git.commit` / `--no-git.commit`             | Commit version and changelog changes                    | `true`             |
| `--git.push` / `--no-git.push`                 | Push commit and tags to remote                          | `true`             |
| `--git.requireBranch <branch>`                 | Require that the release is on a particular branch      | -                  |
| `--retry`                                      | Retry the release version from the release tag at HEAD  | `false`            |
| `--npm.prerelease` / `--no-npm.prerelease`     | Specify the release type as prerelease                  | `false`            |
| `--npm.canary` / `--no-npm.canary`             | Specify the release type as canary                      | `false`            |
| `--npm.registry <registry>`                    | Use one registry for queries, owner checks, and publish | package/npm config |
| `--npm.requireOwner` / `--no-npm.requireOwner` | Require npm ownership of all packages                   | `true`             |
| `--npm.confirm` / `--no-npm.confirm`           | Confirm bump version before publish                     | `true`             |
| `--npm.prereleaseId <id>`                      | Specify a prerelease ID such as alpha/beta/rc/next      | -                  |
| `--github.release` / `--no-github.release`     | Create GitHub Release                                   | `true`             |
| `--github.mode <mode>`                         | Create GitHub Release through `browser` or `api`        | `browser`          |
| `-h, --help`                                   | Display help for command                                | -                  |
```

- [ ] **Step 2: 表后追加 Precedence 小节（CLI Examples 之前）**

```markdown
#### Precedence

Options explicitly passed on the command line always override the
`release.config.ts` file, which in turn overrides built-in defaults:
`CLI > release.config.ts > defaults`. Both positive and negative forms are
accepted for boolean options; when the same option is passed multiple times,
the last occurrence wins.
```

- [ ] **Step 3: CLI Examples 追加示例**

在 README.md:150 代码块末尾（`release patch --git.requireBranch main --no-npm.confirm` 之后）追加：

```bash
# Enable push even when release.config.ts sets git.push to false
release patch --git.push

# Disable independent tags even when release.config.ts enables them
release minor --no-git.independent
```

- [ ] **Step 4: Commit**

```bash
git add packages/release/README.md
git commit -m "docs(release): 更新 CLI 选项文档并说明优先级规则"
```

---

### Task 5: 全量验证

**Files:**

- 无新文件

**Interfaces:**

- Consumes: Task 1-4 产物
- Produces: 可发布状态

- [ ] **Step 1: 全量测试**

Run: `pnpm test`（仓库根）
Expected: PASS。重点观察是否波及其他 spec（`release.spec.ts` 等 mock `../src/cli` 的文件——探查发现 `__tests__/release.spec.ts` 是否 import cli 待执行时确认，若 mock 需补 `createProgram` 导出）

- [ ] **Step 2: 类型 + Lint**

Run: `pnpm typecheck && pnpm lint`
Expected: 双 PASS

- [ ] **Step 3: 构建**

Run: `cd packages/release && pnpm build`
Expected: 成功；`dist/cli.js`、`dist/cli.d.ts` 含 `createProgram`（rslib 入口 `src/**` 全量，无需改构建配置）。dist 被 gitignore，不提交

- [ ] **Step 4: 真实 CLI 冒烟（可选但推荐）**

Run: `node /Users/ender/learning/github/eljs/packages/release/dist/cli.js --help`
Expected: help 输出包含成对选项（`--git.push` 与 `--no-git.push` 都列出）、`--github.mode <mode>` 显示 choices、正形式 `--git.independent`（默认值显示）；`--github.mode gitlab` 报 commander invalidArgument 错误

- [ ] **Step 5: 收尾（如有剩余改动）**

```bash
git status
git add -A && git commit -m "chore(release): CLI option 优化收尾"
```

（无剩余改动则跳过。）

---

## Self-Review

1. **Spec 覆盖**：P0 value-source（Task 2 parseOptions/collectExplicitKeys）✅；P1 双向开关（Task 2 成对声明，changelog 除外并已注明原因）✅；P1 真实 commander 集成测试（Task 1 + Task 2 Step 2b 绿灯）✅；P2 解析层校验（Task 2 choices + checkPrereleaseId）✅；P2 help 可用性（Task 2 文案/`<branch>` 占位符）✅；P3 README（Task 4）✅
2. **占位符扫描**：代码块均为最终版（`showHelpAfterError` 已在链中、action 内用 `hooks.debug?.()`、spec 语法完整闭合）。无 TBD/TODO/未定义引用
3. **类型一致性**：`createProgram(version, hooks)` 在 Task 1（调用 `createProgram('1.0.0')`）、Task 2（定义）、Task 3（mock Command 构造返回 mockProgram）一致；`parseOptions(options, command)` 必传第二参在 Task 2/3 一致；`checkPrereleaseId` 在 Task 2 定义、Task 3 要点 11 消费一致
