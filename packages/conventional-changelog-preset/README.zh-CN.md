# @eljs/conventional-changelog-preset

[English](./README.md)

面向 `@eljs/release` 的 Conventional Changelog 预设，提供提交分组和语义化版本建议。

[![NPM Version](https://img.shields.io/npm/v/@eljs/conventional-changelog-preset.svg)](https://www.npmjs.com/package/@eljs/conventional-changelog-preset)
[![NPM Downloads](https://img.shields.io/npm/dm/@eljs/conventional-changelog-preset.svg)](https://www.npmjs.com/package/@eljs/conventional-changelog-preset)
[![License](https://img.shields.io/npm/l/@eljs/conventional-changelog-preset.svg)](https://github.com/chnliquan/eljs/blob/master/LICENSE)

## 运行要求

- Node.js 22.14 或更高版本
- 提供原生 ESM、CommonJS 入口和 TypeScript 声明

## 安装

```bash
pnpm add @eljs/conventional-changelog-preset
```

`@eljs/release` 已默认使用此预设。配置其他 Conventional Changelog 使用方时，
可直接安装本包。

## 使用

```ts
import createPreset from '@eljs/conventional-changelog-preset'

const preset = await createPreset()
const suggestion = preset.whatBump([{ type: 'feat', notes: [] }])
// suggestion.level === 1（次版本）
```

默认导出是异步工厂，返回 `parser`、`writer` 和 `whatBump`，
实现 Conventional Changelog 的预设契约。

`whatBump` 接受已解析的提交，不会解析原始提交头。
解析器会先将破坏性变更的提交头和页脚转换为 `notes`。

## Changelog 展示规则

| 提交类型                                        | 输出分组                    | 不含破坏性变更 notes 时是否展示 |
| ----------------------------------------------- | --------------------------- | ------------------------------- |
| `feat`                                          | ✨ Features                 | 是                              |
| `fix`                                           | 🐛 Bug Fixes                | 是                              |
| `perf`                                          | ⚡ Performance Improvements | 是                              |
| `revert`                                        | ⏪ Reverts                  | 是                              |
| `refactor`                                      | ♻ Code Refactoring          | 是                              |
| `test`, `docs`, `style`, `build`, `ci`, `chore` | 对应类型的分组              | 否                              |
| 其他类型                                        | 原始类型                    | 否                              |

任何包含破坏性变更 notes 的提交都会展示，与类型无关。
这些 notes 汇总到 `💥 BREAKING CHANGES` 分组。提交按类型分组，
并按 scope 和 subject 排序。写入器还会格式化提交链接、Issue 引用和用户提及。

如果原提交及其 revert 位于同一发布范围，两者会一起过滤；
无法匹配原提交的 revert 会展示在 Reverts 分组。

## 版本建议

Changelog 展示规则与版本建议相互独立。
`whatBump` 使用写入器转换前的原始已解析提交。

| 已解析提交                                | `level` | 建议     |
| ----------------------------------------- | ------- | -------- |
| 至少一条提交包含非空 `notes`              | `0`     | 主版本   |
| 没有破坏性变更 notes，但至少有一条 `feat` | `1`     | 次版本   |
| 其他输入，包括空列表                      | `2`     | 补丁版本 |

因此，refactor 可以展示在 Changelog 中，同时建议补丁版本。
仅包含 docs 的输入即使不展示任何提交，也可能建议补丁版本。

## 提交格式

```text
<type>(<optional scope>): <subject>

<optional body>

<optional footer>
```

通过提交头中的 `!`，或页脚中的 `BREAKING CHANGE:` / `BREAKING-CHANGE:`
识别破坏性变更：

```text
feat(generator)!: require an explicit output directory
```

```text
refactor(config-loader): simplify configuration discovery

BREAKING CHANGE: configuration candidates are now evaluated in declaration order
```

Revert 使用原提交头和提交哈希：

```text
revert: feat(generator): add a template source

This reverts commit 667ecc1654a317a13331b17617d973392f415f02.
```

## 开发

在仓库根目录运行：

```bash
pnpm --filter @eljs/conventional-changelog-preset build
pnpm --filter @eljs/conventional-changelog-preset typecheck
pnpm --filter @eljs/conventional-changelog-preset lint
pnpm --filter @eljs/conventional-changelog-preset test
```
