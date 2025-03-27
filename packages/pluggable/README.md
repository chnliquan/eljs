# @eljs/pluggable

Make pluggable easily.

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

## API

### PluggablePluginApi

```ts
export interface PluggablePluginApi {
  // #region Plugin class fields
  /**
   * Working directory
   */
  cwd: typeof Pluggable.prototype.cwd
  // #endregion

  // #region Plugin methods
  /**
   * Apply plugins
   */
  applyPlugins: typeof Pluggable.prototype.applyPlugins
  /**
   * Register presets
   * @param presets preset declarations
   */
  registerPresets: (presets: PluginDeclaration[]) => void
  /**
   * Register plugins
   * @param plugins plugin declarations
   */
  registerPlugins: (plugins: PluginDeclaration[]) => void
  // #endregion
}
```

### PluginApi

```ts
export interface PluginApi {
  /**
   * Describe plugin
   * @param options.key plugin key
   * @param options.enable whether plugin enable
   */
  describe: (options: { key?: string; enable?: Enable }) => void
  /**
   * Register hook
   * @param key hook key
   * @param fn execute function
   * @param options options
   */
  register: (
    key: HookOptions['key'],
    fn: HookOptions['fn'],
    options: Omit<HookOptions, 'plugin' | 'key' | 'fn'>,
  ) => void
  /**
   * Register method
   * @param name method name
   * @param fn execute function
   */
  registerMethod: (name: string, fn?: MaybePromiseFunction<any>) => void
  /**
   * Skip plugin
   * @param keys plugin key
   */
  skipPlugins: (keys: string[]) => void
}
```
