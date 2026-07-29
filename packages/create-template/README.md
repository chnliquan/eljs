# @eljs/create-template

Create a new project with standard templates powered by @eljs/create.

[![NPM Version](https://img.shields.io/npm/v/@eljs/create-template.svg)](https://www.npmjs.com/package/@eljs/create-template)
[![NPM Downloads](https://img.shields.io/npm/dm/@eljs/create-template.svg)](https://www.npmjs.com/package/@eljs/create-template)
[![License](https://img.shields.io/npm/l/@eljs/create-template.svg)](https://github.com/chnliquan/eljs/blob/master/LICENSE)

## ✨ Features

- 🚀 **Quick Setup** - Instantly create projects with predefined templates
- 🎯 **Scene-Based Selection** - Interactive prompts to choose application scene
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

# Create with specific scene and template
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

| Template            | Description          | Type | Source                         |
| ------------------- | -------------------- | ---- | ------------------------------ |
| `template-npm-web`  | Web Common Template  | npm  | `@eljs/create-plugin-npm-web`  |
| `template-npm-node` | Node Common Template | npm  | `@eljs/create-plugin-npm-node` |

## 📋 Usage Examples

### Interactive Mode

```bash
# Start with interactive prompts
create-template my-awesome-project

# The CLI will prompt you to:
# 1. Select the application scene (currently: NPM)
# 2. Choose from available templates:
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
