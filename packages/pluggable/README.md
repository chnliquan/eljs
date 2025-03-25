# @eljs/pluggable

Make pluggable easily

## Installation

```bash
$ pnpm add @eljs/pluggable
// or
$ yarn add @eljs/pluggable
// ro
$ npm i @eljs/pluggable -S
```

## Usage

```ts
// refer to: https://github.com/chnliquan/eljs/blob/master/packages/release/src/runner.ts
import { Pluggable } from '@eljs/pluggable'

export class Runner extends Pluggable {
  public constructor(options: Config) {
    super(options)
  }

  public async run() {
    // load presets plugins and user config
    await this.load()
    // apply customize plugins
    await this.applyPlugins('')
  }
}

new Runner({
  cwd: 'path/to/working/directory',
  presets: [],
  plugins: [],
}).run()
```
