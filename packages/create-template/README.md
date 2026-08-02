# @eljs/create-template

Create a new project with standard templates powered by @eljs/create.

[![NPM Version](https://img.shields.io/npm/v/@eljs/create-template.svg)](https://www.npmjs.com/package/@eljs/create-template)
[![NPM Downloads](https://img.shields.io/npm/dm/@eljs/create-template.svg)](https://www.npmjs.com/package/@eljs/create-template)
[![License](https://img.shields.io/npm/l/@eljs/create-template.svg)](https://github.com/chnliquan/eljs/blob/master/LICENSE)

## ✨ Features

- 🚀 **Quick Setup** - Instantly create projects with predefined templates
- 🎯 **Scene-Based Selection** - Select from the built-in application templates
- 📦 **Official Templates** - Built-in web and Node.js project templates
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

## 🚀 Quick Start

```bash
# Create a new project with interactive prompts
create-template my-project

# Create with a specific scene and template
create-template my-web-app --scene npm --template template-npm-web

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
| `-s, --scene <scene>`       | Specify the application scene                    | Interactive     |
| `-t, --template <template>` | Specify the application template                 | Interactive     |
| `-f, --force`               | Overwrite target directory if it exists          | `false`         |
| `-m, --merge`               | Merge with target directory if it exists         | `false`         |
| `--allow-template-scripts`  | Allow lifecycle scripts in template dependencies | `false`         |
| `-h, --help`                | Display help for command                         | -               |

## 🎯 Available Scenes & Templates

Based on the current configuration, the following scenes and templates are available:

### NPM Scene

| Template            | Description          | Type | Source                                |
| ------------------- | -------------------- | ---- | ------------------------------------- |
| `template-npm-web`  | Web Common Template  | npm  | `@eljs/create-plugin-npm-web@0.12.1`  |
| `template-npm-node` | Node Common Template | npm  | `@eljs/create-plugin-npm-node@0.12.1` |

## 📋 Usage Examples

### Interactive Mode

```bash
# Start with interactive prompts
create-template my-awesome-project

# The built-in template list has one scene, so the CLI selects it automatically and
# prompts you to choose from available templates:
#    - Web Common Template
#    - Node Common Template
```

### Direct Template Selection

```bash
# Create a web project
create-template my-web-app --scene npm --template template-npm-web

# Create a Node.js project
create-template my-node-api --scene npm --template template-npm-node
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
create-template my-project --scene npm --template template-npm-web --force --cwd ./projects
```

## Programmatic API

```ts
import { CreateTemplate } from '@eljs/create-template'

const creator = new CreateTemplate({
  scene: 'npm',
  template: 'template-npm-web',
  cwd: '/workspace/projects',
})

await creator.run('orders-service')
```

The built-in template list pins official templates to exact versions. All
`ProjectCreator` options, including `force`, `merge`, and `signal`, are passed
through.

## Security model

- Built-in remote templates use exact versions, HTTPS registry URLs, and pinned
  SHA-512 integrity digests
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
