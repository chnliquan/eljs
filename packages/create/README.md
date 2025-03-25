# @eljs/create

Create a project from a remote template

## Installation

```bash
$ npm i @eljs/create -g
```

## Usage

```bash
$ create <template> <project-name>
// or
$ npx @eljs/create <template> <project-name>
```

```bash
Usage: create [options] <template> <project-name>

Options:
  -v, --version   Output the current version
  --cwd <cwd>     Specify the working directory
  -f, --force     Force overwrite existing directory
  --no-install    Skip install dependencies when create done
  -h, --help      display help for command
```

## Configuration

Create a **create.config.ts** file in the project root

```ts
export interface Config {
  /**
   * Working directory
   * @default process.cwd()
   */
  cwd?: string
  /**
   * Local template path or remote template
   */
  template?: string | Template
  /**
   * Whether overwrite existing directory
   * @default false
   */
  force?: boolean
  /**
   * Whether enable default prompts
   * @default true
   */
  defaultQuestions?: boolean
  /**
   * Whether initialize git when create done
   * @default true
   */
  gitInit?: boolean
  /**
   * Whether install dependencies when create done
   * @default true
   */
  install?: boolean
  /**
   * Preset Definition Collection
   */
  presets?: PluginDeclaration[]
  /**
   * Plugin Definition Collection
   */
  plugins?: PluginDeclaration[]
}

/**
 * Remote Template
 */
export interface RemoteTemplate {
  /**
   * 模版源类型
   */
  type: 'npm' | 'git'
  /**
   * 模版值
   */
  value: string
  /**
   * 仓库地址
   */
  registry?: string
}
```
