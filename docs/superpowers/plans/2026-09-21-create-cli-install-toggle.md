# Create CLI --install 双向开关修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 `packages/create` CLI `--no-install` 单向开关——成对声明 `--install` 并用 value-source 过滤，使 CLI 显式值可覆盖模版 `create.config.ts` 的 `install: false`，对齐 release 已落地的模式。

**Architecture:** create/src/cli.ts 的 action handler 接收 commander 第三参 `command`，用 `command.getOptionValueSource(key)` 判断 `install` 是否显式传递：`'cli'`/`'env'` 时透传原值，否则从 options 删除——替换现在的"按值 `!== false` 删除"逻辑。声明层把 `--no-install` 改为成对声明 `option('--install', desc, true)` + `option('--no-install', desc)`，正形式从此合法。仅 `install` 一个键受影响（`-f/-m/-y/--allow-template-scripts` 均为正形式 flag，未传即缺席，无注入问题）。

**Tech Stack:** TypeScript、commander v14.0.3、vitest（root vitest.config.ts，pool=forks，`restoreMocks: true`）、pnpm monorepo。

**Spec:** 本计划自身即 spec（源自本会话对 `packages/create/src/cli.ts`、`__tests__/cli.spec.ts`、`src/core/create-runner.ts` 的检查结论；行为模式对齐已落地的 `docs/superpowers/plans/2026-09-21-release-cli-option-optimization.md`）。commander 探针结论复用该计划的 Global Constraints（成对声明后正形式合法、source 可区分 default/cli、last-one-wins）。

## Global Constraints

- 仓库规则：TSDoc 用中文、不加与标识符/类型同义的注释、收尾跑根 `pnpm typecheck && pnpm lint && pnpm test`（注意 commitlint 要求 subject 小写开头）
- 测试命令在仓库根执行：`pnpm vitest run packages/create/__tests__/cli.spec.ts`
- create 的 cli.spec.ts **不 mock commander**（真实解析 + 真实 `process.argv`），现有用例 74-101 已覆盖 `--no-install` → `install: false`、103-109 已覆盖"未传时 install 键不存在"——这两个行为改后必须保持
- commander v14.0.3 关键事实（上一计划 6 轮探针已验证，直接复用）：
  - 成对声明 `option('--install', desc, true)` + `option('--no-install', desc)` 后：`--install`/`--no-install` 均合法，last-one-wins；未传时 `opts.install === true` 且 `getOptionValueSource('install') === 'default'`；显式传递时 source === `'cli'`
  - 因此：**未传时 opts.install 仍是 true**（不是 undefined），过滤逻辑必须以 source 为准，不能以键存在与否或值判断
- `create/src/cli.ts` 已用局部 `new Command()`（cli.ts:40），无全局单例问题，不需要 createProgram 抽取——改动最小化，不做架构性重构
- `ProjectCreator` 构造签名不变：`(options: ProjectCreatorOptions) => ProjectCreator`，CLI 侧继续传平铺对象

---

### Task 1: 成对声明 + value-source 过滤

**Files:**

- Modify: `packages/create/src/cli.ts:48`（`--no-install` 声明改为成对）
- Modify: `packages/create/src/cli.ts:54-70`（action handler 接收第三参，install 过滤改 source 驱动）
- Modify: `packages/create/README.md:111`（options 表 install 行改为双向形式）
- Test: `packages/create/__tests__/cli.spec.ts`（现有用例回归 + 新增双向覆盖用例）

**Interfaces:**

- Consumes: commander v14 `Command.getOptionValueSource(key)`；上一计划已验证的成对声明语义
- Produces: `create <template> <project-name> --install` 正形式合法且覆盖模版配置；`--no-install` 行为不变；未传时 `install` 键不进入 `ProjectCreator` options

- [ ] **Step 1: 写失败测试（先加双向覆盖用例）**

在 `packages/create/__tests__/cli.spec.ts` 的 `使用真实 Commander 解析参数并运行创建器`（74 行）用例之后，插入新用例：

```typescript
it('显式 --install 传递 true 以覆盖模板配置', async () => {
  process.argv = [
    'node',
    'create',
    '@scope/template',
    'orders-service',
    '--install',
  ]

  await cli()

  expect(mockedProjectCreator).toHaveBeenCalledWith(
    expect.objectContaining({
      install: true,
      template: '@scope/template',
    }),
  )
  expect(run).toHaveBeenCalledWith('orders-service')
})
```

- [ ] **Step 2: 跑测试确认红灯**

Run: `pnpm vitest run packages/create/__tests__/cli.spec.ts`
Expected: 新用例 FAIL——现声明下 `--install` 是 unknown option（commander 报 `error: unknown option '--install'`，真实解析下 action 不执行，`mockedProjectCreator` 未被调用，`expect.objectContaining` 断言失败）；既有用例全部 PASS

- [ ] **Step 3: 改写 cli.ts**

`packages/create/src/cli.ts` 两处修改。声明处（48 行）：

```typescript
    .option('--install', 'Install dependencies after create done', true)
    .option('--no-install', 'Skip install dependencies after create done')
```

action 处（54-70 行）改为：

```typescript
    .action(async (template, projectName, options, command) => {
      debug?.(`template:`, template)
      debug?.(`projectName:`, projectName)
      debug?.(`options:%O`, options)
      const creatorOptions = { ...options }

      // 只有 CLI 显式传递的值才能覆盖模版配置，commander 注入的默认值
      // 与未传递状态的 source 均不为 cli
      const source = command.getOptionValueSource('install')
      if (source !== 'cli' && source !== 'env') {
        delete creatorOptions.install
      }

      await new ProjectCreator({
        ...creatorOptions,
        signal,
        template,
      }).run(projectName)
    })
```

要点：

- commander action 签名 `(…args, command)`：create 用 `.arguments('<template> <project-name>')`，前三个参数是 `template, projectName, options`，第四参即 `Command` 实例
- `delete creatorOptions.install` 兼顾两种非显式情况：source `'default'`（注入 true）与 `undefined`（理论上成对声明带默认值后不会出现，防御保留）
- 其余 flag（`force`/`merge`/`yes`/`allowTemplateScripts`）未传时不在 opts 里，无需过滤

- [ ] **Step 4: 跑测试确认绿灯**

Run: `pnpm vitest run packages/create/__tests__/cli.spec.ts`
Expected: 全部 PASS。重点确认既有两个行为契约未破坏：

- `使用真实 Commander 解析参数并运行创建器`（74-101）：`--no-install` → `install: false`（显式 cli source，透传 false）
- `未显式禁用安装时不覆盖模板配置`（103-109）：未传时 `'install' in options === false`（source default，被删除）

- [ ] **Step 5: 更新 README options 表**

`packages/create/README.md:111` 的 install 行替换为：

```markdown
| `--install` / `--no-install` | Install dependencies after creation | `true` |
```

（表内对齐以渲染为准，保持三列结构；`Description` 列宽度按现表最长行 `Allow dependency lifecycle scripts while loading it` 对齐调整，执行时用 prettier format 校正即可）

- [ ] **Step 6: Commit**

```bash
git add packages/create/src/cli.ts packages/create/__tests__/cli.spec.ts packages/create/README.md
git commit -m "fix(create): install 选项成对声明并按 value-source 过滤"
```

---

### Task 2: 全量验证

**Files:**

- 无新文件

**Interfaces:**

- Consumes: Task 1 产物
- Produces: 可发布状态

- [ ] **Step 1: 全量测试 + 类型 + Lint**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: 三项全过。create 的其他 spec（`project-creator.integration.spec.ts`、`runner.integration.spec.ts`）走程序化 API，不经 commander，理论上不受影响

- [ ] **Step 2: 真实 CLI 冒烟（可选）**

Run: `cd packages/create && pnpm build && node bin/create.js --help | rg -A1 "install"`
Expected: help 中 `--install` 与 `--no-install` 都列出，`--install` 显示 `(default: true)`

- [ ] **Step 3: 收尾 commit（如有剩余改动，无则跳过）**

```bash
git status
git add -A && git commit -m "chore(create): cli install 选项修复收尾"
```

---

## Self-Review

1. **Spec 覆盖**：成对声明（Task 1 Step 3 声明处）✅；value-source 过滤（Task 1 Step 3 action 处）✅；双向覆盖测试（Task 1 Step 1 新用例，断言 `--install` 显式 true 到达 ProjectCreator）✅；既有行为回归（Task 1 Step 4 明确列出两个既有契约）✅；README options 表更新（Task 1 Step 5，已核实 create/README.md:111 存在 install 行）✅；全量验证（Task 2）✅
2. **占位符扫描**：无 TBD/TODO；代码块均为完整可落盘版本；action 签名 `async (template, projectName, options, command)` 与 commander `arguments` 顺序一致
3. **类型一致性**：`command.getOptionValueSource('install')` 返回 `OptionValueSource | undefined`，与 `'cli'`/`'env'` 字面量比较无类型冲突（release 已验证同款用法）；`ProjectCreator` 构造参数不变，测试断言 `expect.objectContaining({ install: true })` 与平铺 options 形态一致
