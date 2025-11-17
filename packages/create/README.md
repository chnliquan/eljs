# @eljs/create

Powerful and flexible project creation tool from templates with comprehensive automation support.

[![NPM Version](https://img.shields.io/npm/v/@eljs/create.svg)](https://www.npmjs.com/package/@eljs/create)
[![NPM Downloads](https://img.shields.io/npm/dm/@eljs/create.svg)](https://www.npmjs.com/package/@eljs/create)
[![License](https://img.shields.io/npm/l/@eljs/create.svg)](https://github.com/chnliquan/eljs/blob/master/LICENSE)

## ✨ Features

- 🚀 **Dual Usage** - Support both CLI and programmatic API usage
- 📦 **Multiple Template Sources** - Support local, npm, and git templates
- 🎯 **Smart Template Resolution** - Automatic template discovery and resolution
- 💬 **Interactive Mode** - User-friendly prompts for directory conflicts
- 🔧 **Plugin System** - Extensible plugin architecture for custom generators
- 🎨 **Template Customization** - Support for custom generators and configurations
- 🛡️ **Type Safety** - Full TypeScript support with comprehensive type definitions

## 📦 Installation

```bash
# Using pnpm (recommended)
pnpm add @eljs/create -g

# Using yarn
yarn global add @eljs/create

# Using npm
npm install @eljs/create -g
```

## 🚀 Quick Start

### CLI Usage (Recommended)

```bash
# Create from npm template
create my-template my-project

# Create from git repository
create https://github.com/user/template.git my-project

# Create from local template
create ./local-template my-project

# Using npx (no global installation needed)
npx @eljs/create my-template my-project
```

### Programmatic API Usage

```typescript
import { Create, defineConfig } from '@eljs/create'

// Simple project creation
const create = new Create({
  template: 'my-template',
})
await create.run('my-project')

// Create with custom options
const create = new Create({
  template: {
    type: 'npm',
    value: '@company/enterprise-template',
    registry: 'https://npm.company.com',
  },
  force: true,
  cwd: '/workspace',
})
await create.run('enterprise-app')
```

## 📖 CLI Reference

### Commands

```bash
create [options] <template> <project-name>
```

### Arguments

| Argument       | Description                                                  |
| -------------- | ------------------------------------------------------------ |
| `template`     | Template source (local path, npm package, or git repository) |
| `project-name` | Name of the project to create                                |

### Template Sources

| Type               | Format                             | Example                                 |
| ------------------ | ---------------------------------- | --------------------------------------- |
| **Local Path**     | `./path` or `/absolute/path`       | `./my-template`, `/usr/templates/react` |
| **NPM Package**    | `package-name` or `@scope/package` | `create-react-app`, `@vue/cli-template` |
| **Git Repository** | `https://...` or `git@...`         | `https://github.com/user/template.git`  |

### Options

| Option          | Description                                 | Default         |
| --------------- | ------------------------------------------- | --------------- |
| `-v, --version` | Output the current version                  | -               |
| `--cwd <cwd>`   | Specify the working directory               | `process.cwd()` |
| `-f, --force`   | Overwrite target directory if it exists     | `false`         |
| `-m, --merge`   | Merge with target directory if it exists    | `false`         |
| `--no-install`  | Skip dependency installation after creation | `true`          |
| `--no-git-init` | Skip git repository initialization          | `true`          |
| `-h, --help`    | Display help for command                    | -               |

### CLI Examples

```bash
# Basic template creation
create react-template my-react-app

# Force overwrite existing directory
create vue-template my-vue-app --force

# Merge with existing directory
create component-template my-component --merge

# Custom working directory
create api-template my-api --cwd ./projects

# From scoped npm package
create @company/enterprise-template my-enterprise-app

# From git repository with branch
create https://github.com/templates/fullstack.git#main my-fullstack-app

# Local template with custom options
create ./templates/custom-template my-custom-app --no-install --no-git-init
```

## 📖 API Reference

### `Create` Class

Main class for programmatic project creation.

```typescript
class Create {
  constructor(options: CreateOptions)
  async run(projectName: string): Promise<void>
}
```

**Constructor Options:**

```typescript
interface CreateOptions {
  /**
   * Working directory
   * @default process.cwd()
   */
  cwd?: string
  /**
   * Template source
   */
  template: string | RemoteTemplate
  /**
   * Whether to overwrite target directory if it exists
   * @default false
   */
  force?: boolean
  /**
   * Whether to merge with target directory if it exists
   * @default false
   */
  merge?: boolean
}
```

**Remote Template Configuration:**

```typescript
interface RemoteTemplate {
  /**
   * Template type
   */
  type: 'npm' | 'git'
  /**
   * Template source value
   */
  value: string
  /**
   * NPM registry URL (npm type only)
   */
  registry?: string
}
```

### API Examples

```typescript
import { Create } from '@eljs/create'

// Local template
const localCreate = new Create({
  template: './my-local-template',
  cwd: '/workspace',
  merge: true,
})
await localCreate.run('local-project')

// NPM template
const npmCreate = new Create({
  template: {
    type: 'npm',
    value: '@scope/template-name',
    registry: 'https://registry.npmjs.org',
  },
  force: true,
})
await npmCreate.run('npm-project')

// Git template
const gitCreate = new Create({
  template: {
    type: 'git',
    value: 'https://github.com/user/template.git#main',
  },
})
await gitCreate.run('git-project')
```

## ⚙️ Configuration

Create a **create.config.ts** file in your project root for persistent configuration:

```typescript
import { defineConfig } from '@eljs/create'

export default defineConfig({
  /**
   * Working directory
   * @default process.cwd()
   */
  cwd: process.cwd(),

  /**
   * Default template source
   */
  template: '@company/default-template',

  /**
   * Directory handling options
   */
  force: false,
  merge: false,

  /**
   * Post-creation options
   */
  install: true,
  gitInit: true,
  defaultQuestions: true,

  /**
   * Custom presets
   */
  presets: ['@company/create-preset'],

  /**
   * Custom plugins
   */
  plugins: ['./plugins/custom-generator.js'],
})
```

## 🔌 Plugin System

Extend creation functionality with custom plugins and generators:

### Custom Generator Plugin

```typescript
// plugins/custom-generator.js
export default {
  name: 'custom-generator',
  async apply(api) {
    // Add custom prompts
    api.addQuestions([
      {
        type: 'input',
        name: 'authorName',
        message: 'What is your name?',
      },
      {
        type: 'select',
        name: 'framework',
        message: 'Choose a framework:',
        choices: ['React', 'Vue', 'Angular'],
      },
    ])

    // Modify package.json
    api.extendPackage({
      author: api.prompts.authorName,
      keywords: [api.prompts.framework.toLowerCase()],
    })

    // Generate files
    api.onGenerateFiles(() => {
      if (api.prompts.framework === 'React') {
        api.copyTpl('templates/react/**', api.paths.target, api.prompts)
      }
    })
  },
}
```

### Template Structure

A complete template should include:

```
my-template/
├── create.config.ts          # Template configuration
├── generators/
│   └── index.ts             # Main generator
├── templates/               # Template files
│   ├── package.json.ejs
│   ├── src/
│   │   └── index.ts.ejs
│   └── README.md.ejs
└── package.json             # Template metadata
```

### Generator Example

```typescript
// generators/index.ts
export default {
  name: 'main-generator',
  async apply(api) {
    // Extend package.json
    api.extendPackage(pkg => ({
      ...pkg,
      name: api.appData.projectName,
      version: '1.0.0',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        test: 'jest',
      },
    }))

    // Copy template files
    api.onGenerateFiles(() => {
      api.copyTpl('templates/**', api.paths.target, {
        ...api.prompts,
        ...api.appData,
      })
    })

    // Post-generation hooks
    api.onGenerateDone(() => {
      console.log(`✅ Project ${api.appData.projectName} created successfully!`)
    })
  },
}
```

## 🏗️ Built-in Generators

### Available Generator Methods

| Method                              | Description             | Example                                         |
| ----------------------------------- | ----------------------- | ----------------------------------------------- |
| `api.copyFile(from, to)`            | Copy single file        | `api.copyFile('template.txt', 'output.txt')`    |
| `api.copyTpl(from, to, data)`       | Copy template with data | `api.copyTpl('src/**', target, prompts)`        |
| `api.copyDirectory(from, to, data)` | Copy entire directory   | `api.copyDirectory('templates', target)`        |
| `api.render(template, data)`        | Render template string  | `api.render('Hello {{name}}', {name: 'World'})` |
| `api.extendPackage(extension)`      | Extend package.json     | `api.extendPackage({scripts: {test: 'jest'}})`  |
| `api.install(deps, options)`        | Install dependencies    | `api.install(['react', 'react-dom'])`           |
