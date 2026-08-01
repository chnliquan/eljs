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
# Create from an npm template
create my-template my-project

# Create from a git repository
create https://github.com/user/template.git my-project

# Create from a local template
create ./local-template my-project

# Using npx (no global installation needed)
npx @eljs/create my-template my-project
```

### Programmatic API Usage

```typescript
import { ProjectCreator, defineConfig } from '@eljs/create'

// Simple project creation
const creator = new ProjectCreator({
  template: 'my-template',
})
await creator.run('my-project')

// Create with custom options
const enterpriseCreator = new ProjectCreator({
  template: {
    type: 'npm',
    value: '@company/enterprise-template',
    registry: 'https://npm.company.com',
  },
  force: true,
  cwd: '/workspace',
})
await enterpriseCreator.run('enterprise-app')
```

`force` 使用可恢复事务：现有目录会先移动到同级临时备份，只有生成完整成功后才删除；下载、插件或文件生成失败时会恢复原目录。`merge` 保留现有目录并合并生成结果。

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

| Option                     | Description                                         | Default         |
| -------------------------- | --------------------------------------------------- | --------------- |
| `-v, --version`            | Output the current version                          | -               |
| `--cwd <cwd>`              | Specify the working directory                       | `process.cwd()` |
| `-f, --force`              | Overwrite target directory if it exists             | `false`         |
| `-m, --merge`              | Merge with target directory if it exists            | `false`         |
| `--no-install`             | Skip dependency installation after creation         | `true`          |
| `-y, --yes`                | Trust and execute the selected remote template      | `false`         |
| `--allow-template-scripts` | Allow dependency lifecycle scripts while loading it | `false`         |
| `-h, --help`               | Display help for command                            | -               |

### CLI Examples

```bash
# Basic template creation
create react-template my-react-app

# Force overwrite existing directory
create vue-template my-vue-app --force

# Merge with existing directory
create component-template my-component --merge

# Custom working directory
create context-template my-context --cwd ./projects

# From scoped npm package
create @company/enterprise-template my-enterprise-app

# From a Git repository branch or tag
create https://github.com/templates/fullstack.git#main my-fullstack-app

# Local template with custom options
create ./templates/custom-template my-custom-app --no-install
```

## 📖 API Reference

### `ProjectCreator` Class

Main class for programmatic project creation.

```typescript
class ProjectCreator {
  constructor(options: ProjectCreatorOptions)
  async run(projectName: string): Promise<void>
}
```

**Constructor Options:**

```typescript
interface ProjectCreatorOptions {
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
  /**
   * Skip the remote template execution confirmation
   * @default false
   */
  yes?: boolean
  /**
   * Allow lifecycle scripts in remote template dependencies
   * @default false
   */
  allowTemplateScripts?: boolean
  /**
   * Cancel downloading, plugin execution, and generation at safe boundaries
   */
  signal?: AbortSignal
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
  /**
   * Skip execution confirmation for a source trusted by the caller
   * @default false
   */
  trusted?: boolean
}
```

### Remote Template Security

Remote templates are executable code and run with the current user's
permissions. The CLI therefore asks for confirmation before downloading and
executing an unknown npm or Git template. Use `--yes` only after verifying the
source and version.

Template dependency lifecycle scripts are disabled by default with
`--ignore-scripts`. If a trusted template requires an install script, enable it
explicitly with `--allow-template-scripts`. This option does not sandbox the
template generator itself.

NPM downloads inherit project and user `.npmrc` authentication, proxy, and
`no-proxy` settings. Credentials are matched to the target host and path and are
not forwarded to an unrelated tarball host. Tarballs are streamed with a 100 MiB
download limit, a 20,000-entry extraction limit, and registry-provided integrity
verification.

### API Examples

```typescript
import { ProjectCreator } from '@eljs/create'

// Local template
const localCreate = new ProjectCreator({
  template: './my-local-template',
  cwd: '/workspace',
  merge: true,
})
await localCreate.run('local-project')

// NPM template
const npmCreate = new ProjectCreator({
  template: {
    type: 'npm',
    value: '@scope/template-name',
    registry: 'https://registry.npmjs.org',
  },
  force: true,
})
await npmCreate.run('npm-project')

// Git template
const gitCreate = new ProjectCreator({
  template: {
    type: 'git',
    value: 'https://github.com/user/template.git#main',
  },
})
await gitCreate.run('git-project')

// Cancellable creation
const controller = new AbortController()
const cancellableCreate = new ProjectCreator({
  template: './my-local-template',
  signal: controller.signal,
})

process.once('SIGINT', () => controller.abort())
await cancellableCreate.run('cancellable-project')
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
import { definePlugin } from '@eljs/create'

export default definePlugin(context => {
  // Add custom prompts
  context.addQuestions(() => [
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
  // The callback runs after prompts and app data are available.
  context.extendPackage(pkg => ({
    ...pkg,
    author: context.prompts.authorName,
    keywords: [context.prompts.framework.toLowerCase()],
  }))

  // Generate files
  context.onGenerateFiles(() => {
    if (context.prompts.framework === 'React') {
      context.copyTpl(
        'templates/react/**',
        context.paths.target,
        context.prompts,
      )
    }
  })
})
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
import { definePlugin } from '@eljs/create'

export default definePlugin(context => {
  // Extend package.json
  context.extendPackage(pkg => ({
    ...pkg,
    name: context.appData.projectName,
    version: '1.0.0',
    scripts: {
      dev: 'vite',
      build: 'vite build',
      test: 'jest',
    },
  }))

  // Copy template files
  context.onGenerateFiles(() => {
    context.copyTpl('templates/**', context.paths.target, {
      ...context.prompts,
      ...context.appData,
    })
  })

  // Post-generation hooks
  context.onGenerateDone(() => {
    console.log(
      `✅ Project ${context.appData.projectName} created successfully!`,
    )
  })
})
```

## 🏗️ Built-in Generators

### Available Generator Methods

| Method                                  | Description             | Example                                             |
| --------------------------------------- | ----------------------- | --------------------------------------------------- |
| `context.copyFile(from, to)`            | Copy single file        | `context.copyFile('template.txt', 'output.txt')`    |
| `context.copyTpl(from, to, data)`       | Copy template with data | `context.copyTpl('src/**', target, prompts)`        |
| `context.copyDirectory(from, to, data)` | Copy entire directory   | `context.copyDirectory('templates', target)`        |
| `context.render(template, data)`        | Render template string  | `context.render('Hello {{name}}', {name: 'World'})` |
| `context.extendPackage(extension)`      | Extend package.json     | `context.extendPackage({scripts: {test: 'jest'}})`  |
| `context.install(deps, options)`        | Install dependencies    | `context.install(['react', 'react-dom'])`           |
