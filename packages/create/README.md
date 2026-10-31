# @eljs/create

[简体中文](./README.zh-CN.md)

Create projects from the latest official Eljs templates.

[![NPM Version](https://img.shields.io/npm/v/@eljs/create.svg)](https://www.npmjs.com/package/@eljs/create)
[![License](https://img.shields.io/npm/l/@eljs/create.svg)](https://github.com/chnliquan/eljs/blob/master/LICENSE)

This is the official project initialization entry point. It selects a template
and delegates generation to [`@eljs/generator`](../generator). Use the generator
directly to supply an arbitrary local, npm, or Git template.

## Runtime Requirements

- Node.js 22.14 or newer
- ESM and CommonJS entries with TypeScript declarations
- npm registry access to download official templates

## Quick Start

```bash
# Select an official template interactively.
npm create @eljs my-project

# Select the npm package template explicitly.
npm create @eljs my-package -- --template template-npm-package

# Equivalent invocation through npx.
npx @eljs/create my-project
```

## Installation

For repeated CLI use:

```bash
pnpm add --global @eljs/create
create my-project
```

For programmatic use:

```bash
pnpm add @eljs/create
```

## Available Templates

| Template               | Creates                                                                  | npm source                               |
| ---------------------- | ------------------------------------------------------------------------ | ---------------------------------------- |
| `template-npm-package` | A single publishable package, with Node or browser target selection      | `@eljs/create-plugin-npm-package@latest` |
| `template-project`     | A full-stack workspace with a web app, documentation, libraries, and CLI | `@eljs/create-plugin-project@latest`     |

Both consume the shared `@eljs/create-preset-base-package` preset. It is a
template dependency rather than a selectable project template.

Templates are published separately from this initializer. Each run resolves
the selected package's `latest` release; template updates do not require a
new initializer release.

## CLI

```bash
create [options] <project-name>
```

| Option                      | Description                                                 | Default               |
| --------------------------- | ----------------------------------------------------------- | --------------------- |
| `-t, --template <template>` | One of the official template identifiers above              | Interactive selection |
| `--cwd <cwd>`               | Working directory                                           | `process.cwd()`       |
| `-f, --force`               | Replace an existing target directory                        | `false`               |
| `-m, --merge`               | Merge generated files into an existing target directory     | `false`               |
| `--allow-template-scripts`  | Allow lifecycle scripts in downloaded template dependencies | `false`               |
| `-v, --version`             | Print the initializer version                               | —                     |
| `-h, --help`                | Print command help                                          | —                     |

`force` and `merge` are mutually exclusive. Generation uses the generator's
directory transaction: failed generation restores the original directory,
and cooperating processes cannot write the same physical target concurrently.
See [transaction recovery](https://github.com/chnliquan/eljs/blob/master/docs/generator-recovery.md).

```bash
create my-package --template template-npm-package
create my-project --template template-project --cwd ./projects
create existing-project --merge
```

## Programmatic API

```ts
import { ProjectCreator } from '@eljs/create'

const creator = new ProjectCreator({
  template: 'template-npm-package',
  cwd: '/workspace/projects',
})

await creator.run('orders-service')
```

`ProjectCreatorOptions` accepts an optional `OfficialTemplateName` and the
generator's creation options except its arbitrary `template` source. Omitting
the template starts interactive selection. Invalid template identifiers fail
with `CREATE_INVALID_OPTIONS`.

Options such as `force`, `merge`, `install`, `gitInit`, `defaultQuestions`, and
`signal` are passed to the generator. Cancellation interrupts template
selection and is forwarded to generation:

```ts
const controller = new AbortController()
const creator = new ProjectCreator({
  template: 'template-npm-package',
  signal: controller.signal,
})

process.once('SIGINT', () => controller.abort())
await creator.run('my-package')
```

`constructorOptions` is a read-only snapshot. `cwd` contains the configured
working directory, defaulting to `process.cwd()`.

## Template Execution

Official template sources use HTTPS npm registry URLs and are trusted by the
initializer, so the remote-code confirmation prompt is skipped. Template
code still runs with the current process permissions.

The initializer does not pin a separate integrity digest because it tracks
`latest`. Downloads use the registry-provided integrity or shasum. Dependency
lifecycle scripts are disabled unless `--allow-template-scripts` is enabled.
See the generator's [template trust settings](https://github.com/chnliquan/eljs/tree/master/packages/generator#template-execution-and-integrity).

## Development

From the repository root:

```bash
pnpm --filter @eljs/create... build
pnpm --filter @eljs/create typecheck
pnpm --filter @eljs/create test
pnpm --filter @eljs/create test:watch
DEBUG=create:* pnpm exec create my-project
```

Verify published templates with npm registry access:

```bash
ELJS_TEST_OFFICIAL_TEMPLATES=1 pnpm exec vitest run packages/create/__tests__/official-templates.integration.spec.ts
```
