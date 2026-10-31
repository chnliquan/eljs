# @eljs/conventional-changelog-preset

[简体中文](./README.zh-CN.md)

Conventional Changelog preset with commit grouping and semantic version
recommendations for `@eljs/release`.

[![NPM Version](https://img.shields.io/npm/v/@eljs/conventional-changelog-preset.svg)](https://www.npmjs.com/package/@eljs/conventional-changelog-preset)
[![NPM Downloads](https://img.shields.io/npm/dm/@eljs/conventional-changelog-preset.svg)](https://www.npmjs.com/package/@eljs/conventional-changelog-preset)
[![License](https://img.shields.io/npm/l/@eljs/conventional-changelog-preset.svg)](https://github.com/chnliquan/eljs/blob/master/LICENSE)

## Runtime Requirements

- Node.js 22.14 or newer
- Native ESM and CommonJS entries with TypeScript declarations

## Installation

```bash
pnpm add @eljs/conventional-changelog-preset
```

`@eljs/release` already uses this preset by default. Install it directly when
configuring another Conventional Changelog consumer.

## Usage

```ts
import createPreset from '@eljs/conventional-changelog-preset'

const preset = await createPreset()
const suggestion = preset.whatBump([{ type: 'feat', notes: [] }])
// suggestion.level === 1 (minor)
```

The default export is an asynchronous factory returning `parser`, `writer`,
and `whatBump`. It implements the Conventional Changelog preset contract.

`whatBump` expects parsed commits. It does not parse a raw commit header:
the parser turns breaking-change headers and footers into `notes` first.

## Changelog Visibility

| Commit type                                     | Section                     | Included without breaking-change notes |
| ----------------------------------------------- | --------------------------- | -------------------------------------- |
| `feat`                                          | ✨ Features                 | Yes                                    |
| `fix`                                           | 🐛 Bug Fixes                | Yes                                    |
| `perf`                                          | ⚡ Performance Improvements | Yes                                    |
| `revert`                                        | ⏪ Reverts                  | Yes                                    |
| `refactor`                                      | ♻ Code Refactoring          | Yes                                    |
| `test`, `docs`, `style`, `build`, `ci`, `chore` | Corresponding type section  | No                                     |
| Other types                                     | Original type               | No                                     |

Any commit containing breaking-change notes is included, regardless of its
type. Notes are collected under `💥 BREAKING CHANGES`. Commits are grouped by
type and sorted by scope and subject. The writer also formats commit links,
issue references, and user mentions.

An original commit and its revert are filtered together when both occur in
the same release range; an unmatched revert appears in the Reverts section.

## Version Recommendations

Changelog visibility and version recommendations are independent. `whatBump`
uses the original parsed commits before the writer transforms them.

| Parsed commits                             | `level` | Recommendation |
| ------------------------------------------ | ------- | -------------- |
| At least one commit has nonempty `notes`   | `0`     | Major          |
| No breaking notes, but at least one `feat` | `1`     | Minor          |
| All other inputs, including an empty list  | `2`     | Patch          |

A refactor can therefore appear in the changelog while suggesting a patch.
A docs-only input can suggest a patch even though no commit is displayed.

## Commit Format

```text
<type>(<optional scope>): <subject>

<optional body>

<optional footer>
```

Breaking changes are recognized through `!` in the header, or
`BREAKING CHANGE:` / `BREAKING-CHANGE:` in the footer:

```text
feat(generator)!: require an explicit output directory
```

```text
refactor(config-loader): simplify configuration discovery

BREAKING CHANGE: configuration candidates are now evaluated in declaration order
```

Reverts use the original commit header and a commit hash:

```text
revert: feat(generator): add a template source

This reverts commit 667ecc1654a317a13331b17617d973392f415f02.
```

## Development

From the repository root:

```bash
pnpm --filter @eljs/conventional-changelog-preset build
pnpm --filter @eljs/conventional-changelog-preset typecheck
pnpm --filter @eljs/conventional-changelog-preset lint
pnpm --filter @eljs/conventional-changelog-preset test
```
