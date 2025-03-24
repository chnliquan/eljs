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
  -v, --version   Output the current version.
  --cwd <cwd>     Specify the working directory.
  -r, --override  Force override existing directory.
  -h, --help      display help for command
```

## Configuration

create a **create.config.ts** file in the project root

```ts
export interface Config {
  /**
   * 模板
   */
  template?: string | Template
  /**
   * Working directory
   * @default process.cwd()
   */
  cwd?: string
  /**
   * Whether override existing directory
   * @default false
   */
  override?: boolean
  /**
   * Whether enable default prompts
   */
  defaultQuestions?: boolean
  /**
   * Whether enable git initialize
   */
  gitInit?: boolean
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
 * Template
 */
export interface Template {
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
