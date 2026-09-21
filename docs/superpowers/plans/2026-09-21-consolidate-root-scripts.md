# 精简根 scripts：release 别名收敛与 pack:check 改名 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 收敛根 package.json 的发布入口——保留高频的 `release:beta`（2.0.0-beta 节奏的活跃通道），删除 5 个低频/可直传的 release 别名；`pack:check` 改名 `package:check` 与 `package:create` 对仗，同步全部引用。

**Architecture:** scripts 纯配置改动，无代码逻辑。删除的 5 个别名（alpha/next/major/minor/patch）等价命令是 `pnpm release -- --npm.prereleaseId=alpha|next` 与 `pnpm release -- major|minor|patch`（zx argv 解析，README:61-63 教的主路径即直传）。`pack:check` → `package:check` 涉及 4 处引用：package.json:23、package.json:37（verify:package 内）、ci.yml:65、ci.yml:99、CONTRIBUTING.md:35。工作区已有未提交的 `pack:check` 值改动（`node --import tsx` → `tsx scripts/check-packages.ts`），该改动正是目标值——直接并入本次提交。

**Tech Stack:** pnpm workspace、GitHub Actions、zx

**Spec:** 2026-09-21 会话内批准的"最合理"方案：保留 `release:beta`（活跃通道留便利），删 `release:alpha/next/major/minor/patch`（等价命令为 pnpm release -- 直传）；`pack:check` → `package:check`；`add-owner` 维持现状；用户未提交的 pack:check 值改动并入本次提交

## Global Constraints

- 不改 `scripts/` 下任何 ts 文件本体；只动 package.json scripts 段、ci.yml、CONTRIBUTING.md
- `release:beta` 保留原值：`tsx scripts/release.ts --npm.prereleaseId=beta`
- `package:check` 的值为用户已改的形态：`tsx scripts/check-packages.ts`（不是 git 里的 `node --import tsx` 形态）
- CONTRIBUTING.md:141-148 的发布命令清单同步：保留 `pnpm release` 与 `pnpm release:beta`，删除 alpha/next 两行，并补一行说明其他通道的直传写法
- Task 完成后运行 `pnpm verify:static`（format:check+lint+typecheck）确认改动文件格式正确；`pnpm package:check` 跑通改名
- 提交信息：`chore: consolidate release aliases and rename pack scripts`
- 工作区里**只有** package.json 的 pack:check 改动是本任务相关的未提交内容——提交前用 `git status` 确认无其他意外混入

---

### Task 1: scripts 收敛与改名

**Files:**

- Modify: `package.json:23、26-32`（scripts 段）
- Modify: `.github/workflows/ci.yml:65、99`
- Modify: `CONTRIBUTING.md:35、141-148`

**Interfaces:**

- Consumes: `scripts/release.ts`（zx argv，`--npm.prereleaseId`/位置参数解析）、`scripts/check-packages.ts`
- Produces: 根 scripts 新集合——`release`、`release:beta` 保留；`release:alpha/next/major/minor/patch` 删除；`pack:check` 更名 `package:check`（值 `tsx scripts/check-packages.ts`）

- [ ] **Step 1: 改 package.json scripts**

scripts 段改动（对照 git 现状 + 工作区未提交的 pack:check 值）：

删除以下 5 行：

```json
    "release:alpha": "tsx scripts/release.ts --npm.prereleaseId=alpha",
    "release:major": "tsx scripts/release.ts major",
    "release:minor": "tsx scripts/release.ts minor",
    "release:next": "tsx scripts/release.ts --npm.prereleaseId=next",
    "release:patch": "tsx scripts/release.ts patch",
```

保留 `release:beta` 原行不动：

```json
    "release:beta": "tsx scripts/release.ts --npm.prereleaseId=beta",
```

改名（值取工作区已改的 tsx 形态）：

```json
    "package:check": "tsx scripts/check-packages.ts",
```

同步 `verify:package`：

```json
    "verify:package": "pnpm build && pnpm package:check",
```

- [ ] **Step 2: 同步 ci.yml 两处**

`.github/workflows/ci.yml:65` 与 `:99` 的 `run: pnpm pack:check` 都改为：

```yaml
run: pnpm package:check
```

- [ ] **Step 3: 同步 CONTRIBUTING.md**

1. 35 行表格行改为：

```markdown
| `pnpm package:check` | Verify installed tarballs, exports, types, CLIs, and files |
```

2. 141-148 行发布命令清单改为：

````markdown
```bash
pnpm release
pnpm release:beta
pnpm release -- --npm.prereleaseId=alpha
pnpm release -- patch
```
````

````

（保留 release 与 release:beta 两行作为主通道，后两行演示低频通道的直传写法，覆盖 alpha/next 与 major/minor/patch 的语义）

- [ ] **Step 4: 验证**

Run: `pnpm verify:static`
Expected: 通过（format:check 校验 package.json/ci.yml/CONTRIBUTING.md 格式，lint、typecheck）

Run: `pnpm package:check`
Expected: 通过（改名生效、脚本可执行；如因网络/发布产物原因失败且错误与本改动无关，记录并以 `pnpm release -- --help` 等轻量方式替代验证 scripts 段解析无误，并在报告中说明）

Run: `rg -n "pack:check|release:(alpha|next|major|minor|patch)" package.json .github CONTRIBUTING.md README.md scripts/`
Expected: 零匹配（`release:beta` 与 `package:check` 不在此列）

- [ ] **Step 5: Commit**

```bash
git status --short   # 确认仅 package.json（含用户并入的值改动）、ci.yml、CONTRIBUTING.md
git add package.json .github/workflows/ci.yml CONTRIBUTING.md
git commit -m "chore: consolidate release aliases and rename pack scripts"
````

---

## Self-Review 结论

- **Spec 覆盖**：5 删 1 留（Step 1）、改名 4 处引用同步（Steps 1-3）、用户未提交值改动并入（Step 1 + Global Constraints）✓
- **占位符扫描**：Step 4 的验证退化分支给了明确替代命令与说明要求，无 TBD ✓
- **一致性**：`package:check` 在 package.json/ci.yml/CONTRIBUTING 三处拼写一致；直传写法 `pnpm release -- --npm.prereleaseId=alpha` 与 zx argv 解析机制一致（README:61-63 同款写法）✓
