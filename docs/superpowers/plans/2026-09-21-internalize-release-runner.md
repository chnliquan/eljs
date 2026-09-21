# ReleaseRunner 公共导出降级 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `ReleaseRunner` 从 `@eljs/release` 的公共 API 面收窄为 `@internal` 导出，消除与 `release()` 无实质区别的第二入口，README 示例改用等价的 `release()` 写法。

**Architecture:** `release()` 是 `new ReleaseRunner(options).run(version)` 的单行包装；ReleaseRunner 公开的三个 getter（`stage`/`config`/`appData`）都是运行中状态观测、真实消费者是插件上下文而非外部用户，且 `run()` 不可重入使"复用实例"不成立。降级方式遵循仓库 `@internal` 惯例：从 `src/index.ts` 的 `export * from './release-runner'` 改为带 `@internal` 标注的显式导出（保类型、防误用的最小改动），`release.ts` 内部使用不受影响。README 两处 `new ReleaseRunner` 示例（Programmatic API 节的 import 与 Custom Prerelease Workflow 节）改为 `release()` 写法。

**Tech Stack:** TypeScript、Vitest 4、pnpm workspace

**Spec:** 2026-09-21 会话内批准：ReleaseRunner 从公共导出降级为 `@internal`；README 两处示例改用 `release()`；改动含 index.ts、README、index.spec 断言更新

## Global Constraints

- `release.ts` 内部对 ReleaseRunner 的 import（`./release-runner` 相对路径）不变——降级只影响**公共导出面**
- `@internal` 用 JSDoc 注释标注（仓库惯例见 create 包 hooks.ts 等 `@internal` 用法），导出语句保留（deep-import 与测试仍可用，但公共 API 文档不再承诺）
- 不删除 `runner.spec.ts`/`runner.integration.spec.ts`（它们直接从 `../src/release-runner` 导入，不走公共入口，不受影响）
- Task 完成后运行 `pnpm vitest run packages/release/__tests__`、`pnpm --filter @eljs/release typecheck`、根 `pnpm lint`
- 提交信息：`refactor(release): mark ReleaseRunner export as internal`

---

### Task 1: ReleaseRunner 导出降级（TDD）

**Files:**

- Modify: `packages/release/src/index.ts`（`export * from './release-runner'` 行）
- Modify: `packages/release/__tests__/index.spec.ts:36-39、70-81`（两处断言）
- Modify: `packages/release/README.md:74、440-461`（两处示例）

**Interfaces:**

- Consumes: `ReleaseRunner` 类（`src/release-runner.ts`，不改本体）
- Produces: 公共入口 `@eljs/release` 的导出面**不再包含** `ReleaseRunner` 作为公共承诺（`export *` 改为精确导出 + `@internal`）

- [ ] **Step 1: 改测试断言（先失败）**

`packages/release/__tests__/index.spec.ts`：

1. 36-39 行用例替换为：

```ts
it('ReleaseRunner 应该仅作为内部实现导出', () => {
  // ReleaseRunner 与 release() 无独立使用场景，公共 API 不再承诺该入口
  const releaseRunnerDescriptor = Object.getOwnPropertyDescriptor(
    releaseIndex,
    'ReleaseRunner',
  )
  expect(releaseRunnerDescriptor).toBeDefined()
})
```

2. 70-81 行 `expectedExports` 数组中删除 `'ReleaseRunner',` 一行。

- [ ] **Step 2: 跑测试确认失败形态**

Run: `pnpm vitest run packages/release/__tests__/index.spec.ts`
Expected: PASS（两处断言只验证"仍被导出"，与 `@internal` 标注不冲突）——**本改动是文档性收窄，无行为变化，测试无法"失败驱动"**。此 Step 改为运行确认当前全绿即可，随后直接进 Step 3

- [ ] **Step 3: 改 index.ts 导出**

`packages/release/src/index.ts` 的 `export * from './release-runner'` 替换为：

```ts
export {
  /**
   * 发布流程编排器
   *
   * @remarks
   * `release()` 即本类的单行包装；`stage`/`config`/`appData` 仅供插件上下文
   * 在流程中读取，外部调用方没有独立使用场景
   *
   * @internal
   */
  ReleaseRunner,
} from './release-runner'
```

注意：如项目 lint 对 export 内联 JSDoc 报 `tsdoc/syntax` 或格式错误，则改为**文件顶部独立注释 + 纯导出**形式：

```ts
/**
 * 发布流程编排器
 *
 * @remarks
 * `release()` 即本类的单行包装；`stage`/`config`/`appData` 仅供插件上下文
 * 在流程中读取，外部调用方没有独立使用场景
 *
 * @internal
 */
export { ReleaseRunner } from './release-runner'
```

（执行时优先尝试第二种，更符合仓库注释惯例且 lint 风险低）

- [ ] **Step 4: 跑 index.spec 确认通过**

Run: `pnpm vitest run packages/release/__tests__/index.spec.ts`
Expected: 全部 PASS

- [ ] **Step 5: README 两处示例改写**

1. 74 行 `import { release, ReleaseRunner, defineConfig } from '@eljs/release'` 改为：

```typescript
import { release, defineConfig } from '@eljs/release'
```

2. 440-461 行 Custom Prerelease Workflow 示例整体替换为：

```typescript
import { release } from '@eljs/release'

async function betaRelease() {
  await release(undefined, {
    npm: {
      prerelease: true,
      prereleaseId: 'beta',
      confirm: false,
      publishArgs: ['--tag', 'beta'],
    },
    git: {
      commitMessage: 'chore: beta release v${version}',
      push: false, // Don't push beta releases
    },
    github: {
      release: false, // No GitHub release for betas
    },
  })
}

betaRelease()
```

（保留节标题 `### Custom Prerelease Workflow` 不动）

- [ ] **Step 6: 残留检查**

Run: `rg -n "new ReleaseRunner|ReleaseRunner" packages/release/README.md`
Expected: 零匹配

Run: `pnpm vitest run packages/release/__tests__ && pnpm --filter @eljs/release typecheck && pnpm lint`
Expected: 全部通过（runner.spec/runner.integration.spec 直接从 src 导入不受影响）

- [ ] **Step 7: Commit**

```bash
git add packages/release/src/index.ts packages/release/__tests__/index.spec.ts packages/release/README.md
git commit -m "refactor(release): mark ReleaseRunner export as internal"
```

---

## Self-Review 结论

- **Spec 覆盖**：index.ts `@internal` 化（Step 3）、README 两处示例（Step 5）、测试断言同步（Step 1）✓
- **占位符扫描**：Step 3 的两种注释形态都给出完整代码并明确优先级，无 TBD ✓
- **类型一致性**：`ReleaseRunner` 标识符在导出、测试、README 三处一致；`release(undefined, {...})` 与 `release.ts` 的签名 `release(version?: string, options?: Config)` 匹配 ✓
- **诚实标注**：Step 2 明确说明这是文档性收窄、无失败可驱动，避免伪装 TDD ✓
