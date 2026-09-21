# release 命令重命名为裸名 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `@eljs/release` 的 bin 命令与 commander 程序名从 `eljs-release` 改为裸名 `release`，与 `create`/`create-template` 的裸动词命名模式统一。

**Architecture:** 纯重命名：`release/package.json` 的 bin 字段、`src/cli.ts` 的 `.name()`、release README 的 10 处、根 README 与 CONTRIBUTING 各 1 处、CLI 测试断言 1 处。锁目录名 `eljs-release-locks-`（`release-lock.ts:62`）与测试临时目录前缀**保持不动**——那是磁盘锁命名空间不是命令名，改名会与用户机器上现存锁目录失联。docs/superpowers/plans/ 历史文档不改（记录当时事实）。

**Tech Stack:** TypeScript、Vitest 4、pnpm workspace

**Spec:** 2026-09-21 会话内批准方案 A：release 的 bin/commander/README 从 `eljs-release` 改为 `release`，与 create 系命名统一；beta 阶段（2.0.0-beta.2）为改名窗口，兼容成本（旧全局安装用户的 `eljs-release` 命令消失）已接受；锁目录名保持不动

## Global Constraints

- 仅重命名命令，不改任何行为、选项、退出码、日志语义
- 锁目录名 `eljs-release-locks-${userNamespace}`（`packages/release/src/internal/release-lock.ts:62`）与所有测试中的 `eljs-release-lock-test-`/`eljs-release-runner-` 临时目录前缀**不改**
- `docs/superpowers/plans/` 下的历史计划文档不改（记录历史事实）
- 唯一保留 `eljs-release` 字样的位置：锁相关代码与历史文档
- Task 完成后运行 `pnpm vitest run packages/release/__tests__`、`pnpm --filter @eljs/release typecheck`、根 `pnpm lint`
- 提交信息：`refactor(release): rename command to bare release`

---

### Task 1: release 命令重命名（TDD）

**Files:**

- Modify: `packages/release/package.json:42`（bin 字段）
- Modify: `packages/release/src/cli.ts:43`（commander `.name()`）
- Modify: `packages/release/__tests__/cli.spec.ts:175`（断言）
- Modify: `packages/release/README.md`（10 处：36、97、134、137、140、143、146、149、516、517 行）
- Modify: `README.md:37`（根）
- Modify: `CONTRIBUTING.md:111`

**Interfaces:**

- Consumes: 无
- Produces: bin 命令 `release`（`./bin/release.js` 不变，bin 键名变）；commander 程序名 `release`

- [ ] **Step 1: 改测试断言（先失败）**

`packages/release/__tests__/cli.spec.ts:175`：

```ts
expect(mockProgram.name).toHaveBeenCalledWith('eljs-release')
```

改为：

```ts
expect(mockProgram.name).toHaveBeenCalledWith('release')
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run packages/release/__tests__/cli.spec.ts`
Expected: FAIL，`应该正确设置 program 基本信息` 用例收到 `'eljs-release'` vs 期望 `'release'` 不匹配（实际收到的还是旧名）

- [ ] **Step 3: 改实现与清单**

1. `packages/release/src/cli.ts:43`：`.name('eljs-release')` → `.name('release')`
2. `packages/release/package.json:42`：`"eljs-release": "./bin/release.js"` → `"release": "./bin/release.js"`

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run packages/release/__tests__/cli.spec.ts`
Expected: 全部 PASS

- [ ] **Step 5: 文档同步**

1. `packages/release/README.md`：10 处 `eljs-release` → `release`（命令用法示例 `eljs-release patch` → `release patch` 等，含 36 行 "`eljs-release` command." 与 516-517 行的恢复提示示例）
2. `README.md:36-37`：`Global installations expose the commands `create`, `create-template`, and `eljs-release`.` → `... and `release`.`
3. `CONTRIBUTING.md:111`：`DEBUG=release:* pnpm exec eljs-release` → `DEBUG=release:* pnpm exec release`

- [ ] **Step 6: 跑 release 全量 + typecheck**

Run: `pnpm vitest run packages/release/__tests__ && pnpm --filter @eljs/release typecheck`
Expected: 全部 PASS

- [ ] **Step 7: 残留检查**

Run: `rg -n "eljs-release" packages/release/src packages/release/package.json packages/release/README.md README.md CONTRIBUTING.md`
Expected: **零匹配**（src/cli.ts、bin、README、根文档全部干净）。锁相关（`release-lock.ts`）与 `__tests__` 临时目录前缀不在此检查范围，允许保留

再 Run: `rg -n "eljs-release" packages/release/__tests__ --glob '!*.md' | rg -v "eljs-release-lock-test|eljs-release-runner|eljs-release-locks"`
Expected: 零匹配

- [ ] **Step 8: 根 lint + 全量测试**

Run: `pnpm lint && pnpm test`
Expected: 全部通过

- [ ] **Step 9: Commit**

```bash
git add packages/release/package.json packages/release/src/cli.ts packages/release/__tests__/cli.spec.ts packages/release/README.md README.md CONTRIBUTING.md
git commit -m "refactor(release): rename command to bare release"
```

- [ ] **Step 10: 本地命令验证（构建产物）**

Run: `pnpm --filter @eljs/release build && cd /tmp && rm -rf release-bin-check && mkdir release-bin-check && cd release-bin-check && npm init -y > /dev/null 2>&1 && npm install /Users/ender/learning/github/eljs/packages/release --no-save > /dev/null 2>&1 && ./node_modules/.bin/release --version; echo "EXIT: $?"; cd /Users/ender/learning/github/eljs && rm -rf /tmp/release-bin-check`
Expected: 输出 `2.0.0-beta.2`（bin 名 `release` 可执行）。若 npm install 因 workspace 依赖失败，退化验证：`node /Users/ender/learning/github/eljs/packages/release/bin/release.js --version`（走本地 dist，验证 bin 入口可用；bin 键名正确性已由 package.json 字面检查保证）

---

## Self-Review 结论

- **Spec 覆盖**：bin/commander/三处文档/测试断言全在 Task 1；锁目录名不动已列入 Global Constraints 与 Step 7 的排除式残留检查 ✓
- **占位符扫描**：Step 10 的退化验证分支两条路径都给了完整命令，无 TBD ✓
- **类型一致性**：无类型变更；commander `.name('release')` 与测试断言 `'release'` 一致 ✓
