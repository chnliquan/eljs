# 修复本地模板目标嵌套被误拒的守卫回归 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 `ProjectCreator` 重叠守卫把"目标目录嵌套在本地模板目录内"（如模板包内 `temp/`）误判为非法的回归，恢复旧版 `create -f . temp` 工作流，同时保留"目标吞掉模板根"方向的真实防护。

**Architecture:** `assertPathsDoNotOverlap`（project-creator.ts:617-638）当前对称拦截两个方向：target 是模板根的祖先（真实风险：备份步 `move(targetDir, backup)` 会把模板整体移走）与 target 嵌套在模板内（过度泛化：渲染源 `src/templates/` 与 `temp/` 是兄弟目录，无重叠）。修复：删除后一方向（`isSameOrDescendant(templatePath, targetPath)` 分支），保留前一方向（含相同路径，`isSameOrDescendant(targetPath, templatePath)`）。**不做** render 边界断言——review 已证实其保护面不完整（`context.copyDirectory/copyFile/copyTpl` 可绕过），制造虚假安全感，而回归场景的渲染源与目标本就无重叠。同步更新现有测试期望、新增集成测试覆盖两个方向，templates 仓库 dev 脚本恢复。

**Tech Stack:** TypeScript (ESM/CJS dual)、Vitest 4、pnpm workspace

**Spec:** 2026-09-21 会话内批准（review 后采纳的最简方案）：1) project-creator.ts:626-629 只保留 `isSameOrDescendant(targetPath, templatePath)` 方向，删除 `isSameOrDescendant(templatePath, targetPath)` 分支；2) create.spec.ts:634-646 `应该拒绝位于本地模版内部的目标目录` 改为期望成功；3) 新增集成测试：`create -f . temp` 场景成功生成 + target 为模板根祖先场景仍拦截；4) templates 仓库 npm-node/npm-web 的 dev 脚本恢复 `create -f . temp` 形式

## Global Constraints

- 所有 TSDoc、实现注释使用中文；TSDoc 摘要/描述不以中英文句号结尾
- 错误消息 `must not overlap` 文案保持不变（仍覆盖"target 吞掉模板根"与"两路径相同"场景）
- `isSameOrDescendant` 函数本身不改（两处调用方语义仍需它）；只改 `assertPathsDoNotOverlap` 的调用组合与 TSDoc
- 单元测试（create.spec.ts）中 `path` 全 mock：`resolve`/`join`/`relative`/`dirname`/`basename`/`isAbsolute` 均有 mock 实现（create.spec.ts:126-165），`resolveProspectiveCanonicalPath` 用真实 `realpath`（node:fs/promises 只 mock 了 `cp`），对不存在路径会逐级回退到词法路径——mock 路径（`/mock/...`）在真实 fs 上不存在，回退结果就是 `path.resolve` 后的路径，依赖 mock 的 `resolve`/`dirname`/`basename` 实现
- 集成测试使用真实临时目录（`mkdtemp`）与真实插件文件（`create.config.js` + `.cjs` 插件），模式照抄 project-creator.integration.spec.ts 现有 fixture
- Task 完成后运行 `pnpm vitest run packages/create/__tests__`、`pnpm --filter @eljs/create typecheck`，最后根 `pnpm lint` + `pnpm test`
- 提交信息遵循 conventional commits（`fix(create): ...`）；templates 仓库单独提交（`chore: ...`）

---

### Task 1: 放宽守卫方向（TDD——单元层）

**Files:**

- Modify: `packages/create/src/core/project-creator.ts:605-638`（`assertPathsDoNotOverlap` 的 TSDoc + 条件）
- Test: `packages/create/__tests__/core/create.spec.ts:634-646`（改既有用例 + 加祖先方向用例）

**Interfaces:**

- Consumes: `resolveProspectiveCanonicalPath`（canonical-path.ts，不改）、`isSameOrDescendant`（本文件，不改）
- Produces: `assertPathsDoNotOverlap(templateRootPath, targetDir)` 新契约——仅当 target 与模板根相同或 target 是模板根祖先时抛 `AppError`（code `CREATE_INVALID_TEMPLATE`，消息不变）

- [ ] **Step 1: 改测试（先失败）**

`packages/create/__tests__/core/create.spec.ts` 中，将 `应该拒绝位于本地模版内部的目标目录` 用例（634-646 行）整体替换为以下三个用例（同一位置）：

```ts
it('应该允许目标目录嵌套在本地模版内部', async () => {
  const create = new ProjectCreator({
    cwd: '/mock/cwd/template',
    template: '/mock/cwd/template',
    force: true,
  })

  await expect(create.run('nested-project')).resolves.toBeUndefined()
  expect(mockedEljs.move).not.toHaveBeenCalledWith(
    '/mock/cwd/template',
    expect.anything(),
  )
  expect(MockedRunner.prototype.run).toHaveBeenCalledWith(
    '/mock/cwd/template/nested-project',
    'nested-project',
  )
})

it('应该拒绝吞掉本地模版根的目标目录', async () => {
  const create = new ProjectCreator({
    cwd: '/mock/cwd',
    template: '/mock/cwd/template',
    force: true,
  })

  await expect(create.run('..')).rejects.toThrow('must not overlap')
  expect(mockedEljs.move).not.toHaveBeenCalled()
})

it('应该拒绝与本地模版根相同的目标目录', async () => {
  const create = new ProjectCreator({
    cwd: '/mock/cwd/template',
    template: '/mock/cwd/template',
    force: true,
  })

  await expect(create.run('.')).rejects.toThrow('must not overlap')
  expect(mockedEljs.move).not.toHaveBeenCalled()
})
```

说明：

- 第一个用例即回归场景（target 在模板内，`path.relative` mock 对 `/mock/cwd/template` → `/mock/cwd/template/nested-project` 返回后代段，旧代码据此拦截）。改为期望成功，并断言备份 `move` 没有碰模板根、runner 收到嵌套 target 路径
- 第二个用例 `cwd='/mock/cwd'`、`run('..')` → target=`/mock/cwd` 是 `/mock/cwd/template` 的祖先（`path.relative` mock 返回 `'../outside'` → 旧新代码都拦截），这是必须保留的方向
- 第三个用例 target=`/mock/cwd/template/.`——**注意**：mock 的 `path.resolve` 实现（`paths.slice(lastAbsoluteIndex).join('/')`）不会规范化 `/.`，`resolve('/mock/cwd/template/.')` 返回 `'/mock/cwd/template/.'`，而 `relative` mock 只对全等或前缀匹配返回空串/后代段，`'/mock/cwd/template/.'` 不全等于 `'/mock/cwd/template'`，断言行为依赖词法比较——**执行时若该用例不稳定，改为** `run('template')`（`cwd: '/mock/cwd'`、`template: '/mock/cwd/template'`、target=`/mock/cwd/template` 与模板根完全相同，`relative` mock 返回 `''`，两方向都命中，必拦）。先按 `run('template')` 形式写，不写 `run('.')`：

```ts
it('应该拒绝与本地模版根相同的目标目录', async () => {
  const create = new ProjectCreator({
    cwd: '/mock/cwd',
    template: '/mock/cwd/template',
    force: true,
  })

  await expect(create.run('template')).rejects.toThrow('must not overlap')
  expect(mockedEljs.move).not.toHaveBeenCalled()
})
```

（即第三个用例最终形态用上面这段，废弃 `run('.')` 变体）

- [ ] **Step 2: 跑测试确认失败形态**

Run: `pnpm vitest run packages/create/__tests__/core/create.spec.ts`
Expected: `应该允许目标目录嵌套在本地模版内部` FAIL（收到 `must not overlap` 拒绝）；另外两个用例 PASS（旧代码对称拦截，祖先与相同场景本就拦截）

- [ ] **Step 3: 改实现**

`packages/create/src/core/project-creator.ts` 的 `assertPathsDoNotOverlap`（605-638 行）改为：

```ts
/**
 * 拒绝会吞掉本地模版根的目标目录
 *
 * @remarks
 * 覆盖流程的备份步会整体移动目标目录；目标一旦是模版根本身或其祖先，
 * 备份会把模版一起移走。目标嵌套在模版目录内是合法工作流（如模板包内
 * 生成 `temp`），渲染源位于 `src` 等子目录时与目标天然无重叠，不做限制。
 * 对已存在路径优先使用真实路径以识别符号链接指向的重叠位置
 *
 * @param templateRootPath - 本地模版根目录
 * @param targetDir - 项目输出目录
 * @throws {@link AppError} 目标与模版根相同或是其祖先时抛出
 */
async function assertPathsDoNotOverlap(
  templateRootPath: string,
  targetDir: string,
): Promise<void> {
  const [templatePath, targetPath] = await Promise.all([
    resolveProspectiveCanonicalPath(templateRootPath),
    resolveProspectiveCanonicalPath(targetDir),
  ])

  if (isSameOrDescendant(targetPath, templatePath)) {
    throw new AppError(
      `Local template ${chalk.cyan(templateRootPath)} and target ${chalk.cyan(targetDir)} must not overlap.`,
      {
        code: 'CREATE_INVALID_TEMPLATE',
        details: { targetDir, templateRootPath },
      },
    )
  }
}
```

变化：删除 `isSameOrDescendant(templatePath, targetPath) ||` 分支，TSDoc 重写为单方向契约。

- [ ] **Step 4: 跑单元测试确认通过**

Run: `pnpm vitest run packages/create/__tests__/core/create.spec.ts`
Expected: 全部 PASS（含三个新用例）

- [ ] **Step 5: 跑 create 包全量测试**

Run: `pnpm vitest run packages/create/__tests__`
Expected: 全部 PASS。若 `target-lock.spec.ts` 或其他文件有依赖旧对称语义的用例失败，逐一核对是否与本修复语义冲突（预期无——target-lock 只管并发互斥，不含 overlap 断言）

- [ ] **Step 6: typecheck**

Run: `pnpm --filter @eljs/create typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/create/src/core/project-creator.ts packages/create/__tests__/core/create.spec.ts
git commit -m "fix(create): allow target directories nested inside local templates"
```

---

### Task 2: 集成层回归测试

**Files:**

- Test: `packages/create/__tests__/project-creator.integration.spec.ts`（追加两个用例到现有 describe 内，复用 createFixture 模式）

**Interfaces:**

- Consumes: Task 1 后的 `ProjectCreator` 行为（嵌套放行 / 吞根拦截）；现有 `createFixture()`（289-306 行，返回 `{ originalFile, targetRoot, templateRoot }`，`cwd` 为类级变量在 afterEach 清理）
- Produces: 无新接口，纯测试

- [ ] **Step 1: 追加集成用例**

在 `packages/create/__tests__/project-creator.integration.spec.ts` 的 `工作目录不存在时应该抛出稳定领域错误` 用例之后（`createFixture` 函数定义之前）追加：

```ts
it('应该在本地模版目录内生成目标项目', async () => {
  const fixture = await createFixture()
  await writeFile(
    path.join(fixture.templateRoot, 'create.config.js'),
    `module.exports = {
  defaultQuestions: false,
  gitInit: false,
  install: false,
  plugins: ['./write.cjs'],
}
`,
  )
  await writeFile(
    path.join(fixture.templateRoot, 'write.cjs'),
    `const fs = require('node:fs')
const path = require('node:path')

module.exports = context => {
  context.onGenerateFiles(() => {
    fs.writeFileSync(path.join(context.paths.target, 'generated.txt'), 'generated\\n')
  })
}
`,
  )

  await expect(
    new ProjectCreator({
      cwd: fixture.templateRoot,
      template: '.',
      force: true,
    }).run('nested'),
  ).resolves.toBeUndefined()

  // 模板资产在生成后仍然存在
  await expect(
    readFile(path.join(fixture.templateRoot, 'create.config.js'), 'utf8'),
  ).resolves.toContain('defaultQuestions')
  await expect(
    readFile(path.join(fixture.templateRoot, 'write.cjs'), 'utf8'),
  ).resolves.toContain('onGenerateFiles')
  await expect(
    readFile(
      path.join(fixture.templateRoot, 'nested', 'generated.txt'),
      'utf8',
    ),
  ).resolves.toBe('generated\n')
})

it('应该拒绝吞掉本地模版根的目标目录', async () => {
  const fixture = await createFixture()

  await expect(
    new ProjectCreator({
      cwd: fixture.templateRoot,
      template: '.',
      force: true,
    }).run('..'),
  ).rejects.toThrow('must not overlap')

  // 拒绝后模板资产未被移动或清理
  await expect(readFile(path.join(fixture.originalFile), 'utf8')).resolves.toBe(
    'original\n',
  )
})
```

说明：

- 第一个用例即完整回归场景：`template: '.'`、cwd=模板根、目标 `nested` 在模板内。断言模板资产（`create.config.js`、`write.cjs`）生成后**原样存在**——这是"不覆盖模板"的核心安全断言；目标内有生成的 `generated.txt`
- 第二个用例：`run('..')` → target 为模板根的父目录（`cwd`），吞掉模板根，必须仍拦截。`originalFile` 在 `targetRoot`（fixture 的 `project` 目录，即 cwd 下）内——拦截发生在任何 move 之前，断言其未被动过
- 注意 `template: '.'` 传字符串 `'.'`（`startsWith('.')` 命中本地模板分支，project-creator.ts:459）

- [ ] **Step 2: 跑集成测试确认通过**

Run: `pnpm vitest run packages/create/__tests__/project-creator.integration.spec.ts`
Expected: 全部 PASS（既有 9 个 + 新增 2 个）。Task 1 已改实现，新用例应直接通过；若 `应该在本地模版目录内生成目标项目` 失败且错误为 `must not overlap`，说明 Task 1 未生效或 `.` 模板路径解析进了非本地分支，回 Task 1 检查

- [ ] **Step 3: 跑 create 包全量 + typecheck + lint**

Run: `pnpm vitest run packages/create/__tests__ && pnpm --filter @eljs/create typecheck && pnpm lint`
Expected: 全部通过

- [ ] **Step 4: Commit**

```bash
git add packages/create/__tests__/project-creator.integration.spec.ts
git commit -m "test(create): cover nested local template targets and ancestor rejection"
```

---

### Task 3: templates 仓库 dev 脚本恢复 + 端到端验证

**Files:**

- Modify: `/Users/ender/learning/github/templates/packages/npm-node/package.json:31`（dev 脚本）
- Modify: `/Users/ender/learning/github/templates/packages/npm-web/package.json:30`（dev 脚本）

**Interfaces:**

- Consumes: Task 1/2 后的 create 行为（这是另一个仓库，用 eljs 本地构建产物验证；templates 的 node_modules 里是发布版 `@eljs/create@2.0.0-beta.2`，不含本修复——端到端必须用 eljs 本地 bin）
- Produces: dev 脚本 `"dev": "DEBUG=create* create -f . temp"`（两个包相同）

- [ ] **Step 1: 改两个 dev 脚本**

npm-node 与 npm-web 的 package.json dev 脚本都改为：

```json
    "dev": "DEBUG=create* create -f . temp",
```

（恢复旧版形态：模板 `.`、目标 `temp`，产物在各自包内 `temp/`）

- [ ] **Step 2: 构建本地 create**

Run: `cd /Users/ender/learning/github/eljs && pnpm --filter @eljs/create build`
Expected: 成功（dist 已含修复）

- [ ] **Step 3: 端到端验证 npm-node**

```bash
cd /Users/ender/learning/github/templates/packages/npm-node
rm -rf temp
yes '' | timeout 240 node /Users/ender/learning/github/eljs/packages/create/bin/create.js . temp --cwd . > /tmp/e2e-node.log 2>&1
echo "EXIT: $?"
ls temp | head -6
cat temp/.npmrc | head -1
tail -2 /tmp/e2e-node.log | sed 's/\x1b\[[0-9;?]*[a-zA-Z]//g'
```

Expected: EXIT 0、`temp/` 有完整产物、`.npmrc` registry 非空、结尾 `Created project temp successfully`。**注意**：`--install` 默认开（dev 脚本没传 `--no-install`），用 eljs 本地 bin 直跑等价命令时 install 走发布版逻辑，registry 已由上一修复保证非空，应成功；若网络原因失败且错误与 overlap 无关，可加 `--no-install` 重跑并单独验证 install 不在本任务范围

- [ ] **Step 4: 端到端验证 npm-web**

同 Step 3，在 `npm-web` 下执行。

- [ ] **Step 5: 清理验证产物**

```bash
rm -rf /Users/ender/learning/github/templates/packages/npm-node/temp /Users/ender/learning/github/templates/packages/npm-web/temp
```

- [ ] **Step 6: templates 仓库提交**

```bash
cd /Users/ender/learning/github/templates
git add packages/npm-node/package.json packages/npm-web/package.json
git commit -m "chore: restore in-package temp generation for template dev workflows"
```

注意：templates 仓库当前有大量你自己的未提交改动（`.github/workflows`、`README.md`、`commitlint.config.ts` 等）——**只 add 两个 package.json**，不要 `git add -A`

---

## Self-Review 结论

- **Spec 覆盖**：守卫方向修改（Task 1 Step 3）、既有测试改期望（Task 1 Step 1 第一个用例）、祖先方向仍拦截（Task 1 Step 1 第二个用例 + Task 2 第二个用例）、`create -f . temp` 集成场景（Task 2 第一个用例 + Task 3 端到端）、templates dev 脚本恢复（Task 3）✓
- **占位符扫描**：Task 1 Step 1 中废弃的 `run('.')` 变体已明确标注"最终形态用 `run('template')`"，无 TBD ✓
- **类型一致性**：`assertPathsDoNotOverlap(templateRootPath: string, targetDir: string): Promise<void>` 签名不变，仅抛错条件收窄；集成用例的 `ProjectCreator({ cwd, template, force })` 与现有用例形态一致 ✓
- **测试环境事实核对**：create.spec.ts 的 `path` 全 mock（:126-165）与 `realpath` 真实（node:fs/promises 只 mock cp，:55-58）已确认；集成测试 fixture 模式（mkdtemp + create.config.js + .cjs 插件）照抄现有实现（:289-306、:66-84）✓
