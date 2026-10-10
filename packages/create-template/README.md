# @eljs/create-template

An opinionated project initializer backed by official templates and
`@eljs/create`. Built-in templates always resolve to each template package's
`latest` release.

[![NPM Version](https://img.shields.io/npm/v/@eljs/create-template.svg)](https://www.npmjs.com/package/@eljs/create-template)
[![NPM Downloads](https://img.shields.io/npm/dm/@eljs/create-template.svg)](https://www.npmjs.com/package/@eljs/create-template)
[![License](https://img.shields.io/npm/l/@eljs/create-template.svg)](https://github.com/chnliquan/eljs/blob/master/LICENSE)

The historical name means "create a project from a template." This package
does not author or publish template packages. Use `@eljs/create` when you need
to supply an arbitrary local, npm, or Git template source.

## ✨ Features

- 🚀 **Quick Setup** - Instantly create projects with predefined templates
- 🎯 **Template Selection** - Select directly from the built-in application templates
- 📦 **Official Templates** - Built-in NPM package and full-stack project templates
- 💬 **Interactive Mode** - User-friendly CLI with smart prompts
- 🔧 **Configurable** - Support for custom working directory and merge options

## 📦 Installation

```bash
# Using pnpm (recommended)
pnpm add @eljs/create-template -g

# Using yarn
yarn global add @eljs/create-template

# Using npm
npm install @eljs/create-template -g
```

Global installations expose a single `create-template` command. You can also
run it without installing anything via `npx @eljs/create-template`.

## 🚀 Quick Start

```bash
# Create a new project with interactive prompts
create-template my-project

# Create with a specific template
create-template my-package --template template-npm-package

# Force overwrite existing directory
create-template my-project --force

# Using npx (no global installation needed)
npx @eljs/create-template my-project
```

## 📖 CLI Reference

### Command

```bash
create-template [options] <project-name>
```

### Arguments

| Argument       | Description                   | Required |
| -------------- | ----------------------------- | -------- |
| `project-name` | Name of the project to create | ✅       |

### Options

| Option                      | Description                                      | Default         |
| --------------------------- | ------------------------------------------------ | --------------- |
| `-v, --version`             | Output the current version                       | -               |
| `--cwd <cwd>`               | Specify the working directory                    | `process.cwd()` |
| `-t, --template <template>` | Specify the application template                 | Interactive     |
| `-f, --force`               | Overwrite target directory if it exists          | `false`         |
| `-m, --merge`               | Merge with target directory if it exists         | `false`         |
| `--allow-template-scripts`  | Allow lifecycle scripts in template dependencies | `false`         |
| `-h, --help`                | Display help for command                         | -               |

## 🎯 Available Templates

The following built-in templates are available:

| Template               | Description                 | Type | Source                                   |
| ---------------------- | --------------------------- | ---- | ---------------------------------------- |
| `template-npm-package` | NPM Package Template        | npm  | `@eljs/create-plugin-npm-package@latest` |
| `template-project`     | Full-stack Project Template | npm  | `@eljs/create-plugin-project@latest`     |

`template-npm-package` scaffolds a single publishable package and then asks whether
it targets Node or the browser. `template-project` scaffolds a full-stack workspace
(web app, docs site, library packages, and CLI). The shared base preset
`@eljs/create-preset-base-package` is consumed by both and is not exposed as an entry.

## 📋 Usage Examples

### Interactive Mode

```bash
# Start with interactive prompts
create-template my-awesome-project

# The CLI prompts you to choose from available templates:
#    - NPM Package Template
#    - Full-stack Project Template
```

### Direct Template Selection

```bash
# Create an NPM package
create-template my-package --template template-npm-package

# Create a full-stack project
create-template my-project --template template-project
```

### Advanced Usage

```bash
# Force overwrite existing directory
create-template existing-project --force

# Merge with existing directory
create-template existing-project --merge

# Custom working directory
create-template new-project --cwd ./workspace

# Combine multiple options
create-template my-project --template template-npm-package --force --cwd ./projects
```

## Programmatic API

```ts
import { CreateTemplate } from '@eljs/create-template'

const creator = new CreateTemplate({
  template: 'template-npm-package',
  cwd: '/workspace/projects',
})

await creator.run('orders-service')
```

The internal built-in template list always resolves official templates to
their `latest` published version, so a template release becomes available
immediately without redeploying `create-template`. All `ProjectCreator`
options, including `force`, `merge`, and `signal`, are passed through.

## Security model

- Built-in remote templates are maintained by this repository and use HTTPS
  registry URLs; the confirmation prompt is skipped (`trusted: true`) because
  the source is controlled by the maintainers
- No `integrity` digest is pinned, since always tracking `latest` and pinning
  a digest to specific bytes are mutually exclusive. Each download still
  falls back to the registry-provided integrity or shasum. See
  [`@eljs/create`'s "Choosing `trusted` and `integrity`"](https://github.com/chnliquan/eljs/tree/master/packages/create#choosing-trusted-and-integrity)
  for the tradeoff
- Template dependency lifecycle scripts are disabled by default; only enable
  `--allow-template-scripts` for a source you control

## Development

From the repository root:

```bash
# Build dependencies and this package
pnpm --filter @eljs/create-template... build

# Run package tests once or in watch mode
pnpm --filter @eljs/create-template test
pnpm --filter @eljs/create-template test:watch

# Verify the published official packages (requires npm registry access)
ELJS_TEST_OFFICIAL_TEMPLATES=1 pnpm exec vitest run packages/create-template/__tests__/official-templates.integration.spec.ts

# Run static checks
pnpm --filter @eljs/create-template typecheck
pnpm exec eslint packages/create-template --max-warnings=0

# Debug the built CLI
DEBUG=create-template:* pnpm exec create-template my-project
```
