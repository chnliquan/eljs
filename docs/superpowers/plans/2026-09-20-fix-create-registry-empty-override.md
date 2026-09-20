# 修复 create 内置 prompts 插件空串覆盖 bug 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 `@eljs/create` 内置 prompts 插件第二个 `modifyPrompts` 钩子用 memo 空串占位值覆盖计算出的默认值的 bug，使生成的项目 `.npmrc` / `package.json` 的 `registry` 不再为空，消除下游 `pnpm install` 的 `[ERR_INVALID_URL]` 失败。

**Architecture:** create-runner 传给 `modifyPrompts` 的初值把 8 个内置键（author/email/gitUrl/gitHref/registry/year/date/dateTime）全部预置为空串，表示"未设置"。第一个钩子合并交互答案后这些键仍是空串（用户没有被问 registry）。第二个钩子目前 `return {...defaults, ...memo}`，空串覆盖默认值。修复：第二个钩子展开 memo 后，对内置键仅回填非空值——即"空串/null/undefined 视为未设置，取计算出的默认值；非空用户值仍覆盖默认"。补一个 `pickDefined` 局部辅助函数，不新增文件。

**Tech Stack:** TypeScript (ESM/CJS dual)、Vitest 4、pnpm workspace

**Spec:** 2026-09-20 会话内批准的方案（用户在两选项中选定"修复内置插件合并"：在第二个 modifyPrompts 钩子里构造返回值时对内置键仅在 memo 值为非空时保留，空串/null/undefined 视为未设置；初值契约与其他插件 `...memo` 展开行为不变）

## Global Constraints

- 所有 TSDoc、实现注释使用中文；TSDoc 摘要/描述不以中英文句号结尾
- 不改变 create-runner 的 `modifyPrompts` 初值契约（`initialValue` 仍是 8 个空串键）——其他插件与既有测试依赖该形状
- 不改变非内置键的行为：memo 中其他属性（含 `$$isFirstTime`、preset 追加的键）继续原样透传
- 修改后 `gitUrl: ''` 的既有测试断言（"对于空的 git URL 应该使用占位符"期望 `result.gitUrl` 为 `''`）**保持不变**——`gitUrl` 的占位符替换发生在读取 memo 之后、构造返回值之前，不受本次合并次序调整影响，实现后若该测试失败说明实现改变了占位符逻辑，需回退分析
- Task 完成后运行 `pnpm --filter @eljs/create test`（vitest 根配置会跑 create 包测试）、`pnpm --filter @eljs/create typecheck`，最后根 `pnpm lint`
- 提交信息遵循 conventional commits（`fix(create): ...`）

---

### Task 1: 修复第二个 modifyPrompts 钩子的空串覆盖（TDD）

**Files:**

- Modify: `packages/create/src/internal/plugins/prompts.ts:26-64`（第二个钩子返回结构）
- Test: `packages/create/__tests__/internal/plugins/prompts.spec.ts`（`第二个 modifyPrompts 回调（数据处理）` describe 块内追加用例）

**Interfaces:**

- Consumes: 既有局部变量 `author`、`email`（来自 `../utils`），钩子内计算的 `gitUrl`、`gitHref`、`registry`、`year`、`date`、`dateTime`
- Produces: 第二个钩子返回值形状不变（`PromptMemo` 超集）；新增文件内局部辅助函数 `pickBuiltInValues`（不导出）

- [ ] **Step 1: 写失败测试**

在 `packages/create/__tests__/internal/plugins/prompts.spec.ts` 的 `describe('第二个 modifyPrompts 回调（数据处理）', ...)` 块内、`it('应该保留现有的 memo 属性', ...` 用例之后追加以下用例（紧贴现有风格）：

```ts
it('memo 内置键为空串时不应该覆盖默认值', () => {
  promptsPlugin(mockContext)

  // create-runner 的 modifyPrompts 初值把内置键预置为空串占位
  const memo: PromptMemo = {
    author: '',
    email: '',
    gitUrl: '',
    gitHref: '',
    registry: '',
    year: '',
    date: '',
    dateTime: '',
  }
  const result = secondModifyPromptsCallback(memo)

  expect(result.author).toBe('Test Author')
  expect(result.email).toBe('test@example.com')
  expect(result.gitUrl).toBe('{{gitUrl}}')
  expect(result.gitHref).toBe('{{gitHref}}')
  expect(result.registry).toBe('https://custom-registry.com')
  expect(result.year).toBe('2023')
  expect(result.date).toBe('2023-12-01')
  expect(result.dateTime).toBe('2023-12-01 10:30:45')
})

it('memo 内置键为 null 或 undefined 时也应该回填默认值', () => {
  promptsPlugin(mockContext)

  const memo: PromptMemo = {
    author: undefined,
    email: null,
    registry: undefined,
  }
  const result = secondModifyPromptsCallback(memo)

  expect(result.author).toBe('Test Author')
  expect(result.email).toBe('test@example.com')
  expect(result.registry).toBe('https://custom-registry.com')
})

it('memo 内置键为非空用户值时仍然覆盖默认值', () => {
  promptsPlugin(mockContext)

  const memo: PromptMemo = {
    author: 'Original Author',
    registry: 'https://my-registry.example.com',
  }
  const result = secondModifyPromptsCallback(memo)

  expect(result.author).toBe('Original Author')
  expect(result.registry).toBe('https://my-registry.example.com')
})

it('github 项目 memo registry 为空串时应该回填默认 registry', () => {
  promptsPlugin(mockContext)

  mockInternalUtils.getGitHref.mockReturnValue('https://github.com/test/repo')

  const memo: PromptMemo = {
    gitUrl: 'git@github.com:test/repo.git',
    registry: '',
  }
  const result = secondModifyPromptsCallback(memo)

  expect(result.registry).toBe('https://registry.npmjs.org')
})
```

注意现有 mock 环境：`mockInternalUtils.author` 为 `'Test Author'`、`email` 为 `'test@example.com'`（beforeEach 中设置），`mockChildProcess.execSync` 返回 `'https://custom-registry.com\n'`（无 github href 时 registry 取该值），dayjs mock 使 `year/date/dateTime` 为 `'2023'/'2023-12-01'/'2023-12-01 10:30:45'`。若实际值不同以现有测试 `应该添加默认模板变量` 用例的期望值为准调整。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run packages/create/__tests__/internal/plugins/prompts.spec.ts`
Expected: 新增 4 个用例 FAIL（`registry` 等收到 `''`/`undefined` 而非默认值），既有用例 PASS

- [ ] **Step 3: 写实现**

`packages/create/src/internal/plugins/prompts.ts` 第二个钩子（现 26-64 行）改为：

```ts
context.modifyPrompts(memo => {
  let gitUrl = memo.gitUrl
  let gitHref: string

  if (!gitUrl || (!gitUrl.startsWith('git') && !gitUrl.startsWith('http'))) {
    gitUrl = '{{gitUrl}}'
    gitHref = '{{gitHref}}'
  } else {
    gitHref = getGitHref(gitUrl) || '{{gitHref}}'
  }

  const year = dayjs().format('YYYY')
  const date = dayjs().format('YYYY-MM-DD')
  const dateTime = dayjs().format('YYYY-MM-DD hh:mm:ss')

  let registry = 'https://registry.npmjs.org'

  if (!gitHref.includes('github')) {
    try {
      registry = execSync('npm config get registry').toString().trim()
    } catch (error) {
      // ...
    }
  }

  return {
    ...{
      author,
      email,
      gitUrl,
      gitHref,
      registry,
      year,
      date,
      dateTime,
    },
    ...memo,
    // create-runner 的初值把内置键预置为空串占位，非空用户值才允许覆盖默认值
    ...pickBuiltInValues(memo, {
      author,
      email,
      gitUrl,
      gitHref,
      registry,
      year,
      date,
      dateTime,
    }),
  }
})
```

并在文件末尾（`export default definePlugin(...)` 之后、文件级）追加局部辅助函数：

```ts
/**
 * 收集 memo 中已由用户显式设置的内置键值
 *
 * @remarks
 * create-runner 传入的初值把内置键预置为空串占位；
 * 空串、null 与 undefined 均视为未设置，交由默认值兜底
 *
 * @param memo - 上一个钩子累积的输入
 * @param defaults - 当前钩子计算出的内置默认值
 * @returns 仅包含非空内置键的部分对象
 */
function pickBuiltInValues(
  memo: Record<string, unknown>,
  defaults: Record<string, unknown>,
): Record<string, unknown> {
  const picked: Record<string, unknown> = {}

  for (const key of Object.keys(defaults)) {
    const value = memo[key]
    if (value !== '' && value !== null && value !== undefined) {
      picked[key] = value
    }
  }

  return picked
}
```

关键点：`gitUrl` 的占位符替换逻辑（`memo.gitUrl` 为空/非法时改成 `'{{gitUrl}}'`）发生在钩子开头并写入局部 `gitUrl` 变量，`defaults` 里用的就是处理后的值——所以 `"对于空的 git URL 应该使用占位符"` 既有用例中 `result.gitUrl` 仍为 `'{{gitUrl}}'`（注意：该既有用例此前断言 `result.gitUrl` 为 `''`，因为旧代码 `...memo` 回填了空串；修复后行为变为返回占位符 `'{{gitUrl}}'`，**需要同步把该用例的期望从 `''` 更新为 `'{{gitUrl}}'`**——这是修复的正确行为：模板渲染拿到 `{{gitUrl}}` 占位符而非空串）。

- [ ] **Step 4: 更新受行为变化影响的既有用例期望**

在 `packages/create/__tests__/internal/plugins/prompts.spec.ts` 中：

1. `对于无效的 git URL 应该使用占位符` 用例：`expect(result.gitUrl).toBe('invalid-url')` 保持不变（`'invalid-url'` 非空，保留 memo 值）
2. `对于空的 git URL 应该使用占位符` 用例：将 `expect(result.gitUrl).toBe('')` 改为 `expect(result.gitUrl).toBe('{{gitUrl}}')`（空串不再回填，取钩子内已计算的占位符），并在该行上方加注释 `// 空串占位不再覆盖钩子计算出的占位符`

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm vitest run packages/create/__tests__/internal/plugins/prompts.spec.ts`
Expected: 全部 PASS（新增 4 + 既有全部）

- [ ] **Step 6: 跑 create 包全量测试确认无回归**

Run: `pnpm vitest run packages/create/__tests__`
Expected: 全部 PASS。特别关注 `built-in.spec.ts`、`core/` 下是否有断言空 registry 的用例；若有失败，逐个核对失败是否为本次行为变化的正确结果（占位符替代空串），只调整与修复语义一致的期望，不回退实现

- [ ] **Step 7: typecheck + lint**

Run: `pnpm --filter @eljs/create typecheck && pnpm lint`
Expected: 通过

- [ ] **Step 8: 端到端验证（原始 bug 场景）**

Run（在 templates 仓库 npm-node 目录，用 eljs 本地链接的 create——注意 templates 的 node_modules 里是发布版 2.0.0-beta.1，需先确认是否指向本地）：

```bash
ls -la /Users/ender/learning/github/templates/node_modules/.pnpm | rg "create@2.0.0"
```

若为发布版（非 file: 链接），改用 eljs 仓库本地构建产物直接跑：

```bash
cd /Users/ender/learning/github/eljs && pnpm --filter @eljs/create build
cd /Users/ender/learning/github/templates/packages/npm-node && rm -rf ../temp
yes '' | timeout 90 node /Users/ender/learning/github/eljs/packages/create/bin/create.js ./npm-node temp --cwd .. --no-install > /tmp/gen3.log 2>&1
cat /Users/ender/learning/github/templates/packages/temp/.npmrc
rg -n '"registry"' /Users/ender/learning/github/templates/packages/temp/package.json
```

Expected: `.npmrc` 首行 `registry=https://registry.npmjs.org`（或本机 `npm config get registry` 的值，取决于 gitUrl 是否 github），`package.json` 的 `publishConfig.registry` 同为非空 URL。最后补一次完整 `pnpm dev` 验证 install 成功：

```bash
cd /Users/ender/learning/github/templates/packages/npm-node && yes '' | timeout 180 pnpm dev > /tmp/dev3.log 2>&1; echo "EXIT: $?"; tail -3 /tmp/dev3.log | sed 's/\x1b\[[0-9;?]*[a-zA-Z]//g'
```

Expected: EXIT 0，无 `[ERR_INVALID_URL]`、无 `ELIFECYCLE` 失败。验证后清理生成物：`rm -rf /Users/ender/learning/github/templates/packages/temp`

- [ ] **Step 9: Commit**

```bash
cd /Users/ender/learning/github/eljs && git add packages/create/src/internal/plugins/prompts.ts packages/create/__tests__/internal/plugins/prompts.spec.ts && git commit -m "fix(create): stop empty placeholder overrides of built-in prompt defaults"
```

---

## Self-Review 结论

- **Spec 覆盖**：批准方案的核心（第二个钩子对内置键仅保留非空 memo 值）在 Task 1 Step 3 实现；空串/null/undefined 三种"未设置"形态均有测试（Step 1 用例 2）；非空用户值覆盖默认的兼容性有测试（Step 1 用例 3）；端到端原始场景验证（Step 8）✓
- **占位符扫描**：无 TBD/TODO；Step 8 中 `rg "create@2.0.0"` 是探测命令而非占位，两条分支（发布版/本地构建）都给了完整命令 ✓
- **类型一致性**：`pickBuiltInValues(memo: Record<string, unknown>, defaults: Record<string, unknown>): Record<string, unknown>` 定义与调用处一致；memo 在钩子签名中类型为 `Prompts`（`Record<string, unknown>` 兼容其索引签名，如 typecheck 报不兼容则在该文件内以 `memo as Record<string, unknown>` 收窄）✓
- **既有用例影响面**：已识别唯一期望值变化的用例（`对于空的 git URL 应该使用占位符`）并给出精确修改；`应该保留现有的 memo 属性`（`author: 'Original Author'` 非空）行为不变 ✓
