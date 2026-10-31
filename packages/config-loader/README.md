# @eljs/config-loader

[简体中文](./README.zh-CN.md)

Configuration discovery, loading, merging, and validation for Node.js tools.

[![NPM Version](https://img.shields.io/npm/v/@eljs/config-loader.svg)](https://www.npmjs.com/package/@eljs/config-loader)
[![License](https://img.shields.io/npm/l/@eljs/config-loader.svg)](https://github.com/chnliquan/eljs/blob/master/LICENSE)

## Runtime Requirements

- Node.js 22.14 or newer
- ESM and CommonJS entries with TypeScript declarations

## Installation

```bash
pnpm add @eljs/config-loader
```

## Quick Start

Create `app.config.json`:

```json
{
  "server": { "port": 8080 }
}
```

Load it with defaults:

```ts
import { ConfigLoader } from '@eljs/config-loader'

const loader = new ConfigLoader({
  defaultConfigFiles: ['app.config.ts', 'app.config.js', 'app.config.json'],
  cwd: process.cwd(),
})

const config = await loader.getConfig({
  server: { host: 'localhost', port: 3000 },
})

console.log(config.server) // { host: 'localhost', port: 8080 }
console.log(loader.mainConfigFile) // Absolute path to app.config.json
```

Only the first existing regular-file candidate is selected. With defaults,
the result is non-null and its TypeScript shape is inferred from those
defaults. Without defaults, `getConfig()` returns `null` when no configuration
is found. TypeScript inference does not validate file contents.

## Discovery and Merge Order

```ts
const loader = new ConfigLoader({
  defaultConfigFiles: ['app.config.ts', 'app.config.json'],
  defaultConfigExts: ['local', 'development'],
  cwd: './config',
})
```

If `app.config.ts` exists, the order is:

```text
default configuration
→ app.config.ts
→ app.config.local.ts
→ app.config.development.ts
→ final validation
```

Missing environment files are skipped. Later values override earlier values;
arrays are concatenated by the default deep merge. Supply `merge` when arrays
should be replaced or another merge policy is required.

Environment suffixes are explicit strings. The loader does not load `.env`
files or automatically interpret `NODE_ENV`.

## API

### Constructor

```ts
import type { ConfigLoaderOptions } from '@eljs/config-loader'

const options: ConfigLoaderOptions = {
  defaultConfigFiles: ['app.config.json'],
  defaultConfigExts: ['local'],
  cwd: process.cwd(),
}
```

| Option                                  | Contract                                                                                      |
| --------------------------------------- | --------------------------------------------------------------------------------------------- |
| `defaultConfigFiles: readonly string[]` | Ordered main-file candidates; selects the first regular file                                  |
| `defaultConfigExts?: readonly string[]` | Environment suffixes, merged in declaration order                                             |
| `cwd?: string`                          | Relative-path base; defaults to `process.cwd()`                                               |
| `merge?: ConfigMerge`                   | Synchronous merge callback; must preserve the caller's expected shape without mutating inputs |
| `validate?: ConfigValidator`            | Synchronous validation or normalization after merging                                         |
| `reload?: boolean`                      | Re-evaluate an asynchronous JavaScript entry module                                           |

`constructorOptions` is a read-only snapshot, including frozen copies of the
candidate and suffix arrays. `mainConfigFile` reflects the most recent
instance load; it is `undefined` before loading or when no candidate is found.

### Instance Loading

```ts
const optionalConfig = await loader.getConfig()
const configWithDefaults = await loader.getConfig({ enabled: true })
const synchronousConfig = loader.getConfigSync({ enabled: true })
```

### Static Loading

Static methods load and merge every supplied file in order, rather than
selecting a main-file candidate. Pass absolute paths:

```ts
import { ConfigLoader, getAbsFiles } from '@eljs/config-loader'

const files = getAbsFiles(['base.config.json', 'override.config.json'])
const config = await ConfigLoader.getConfig(files, { enabled: true })
const syncConfig = ConfigLoader.getConfigSync(files, { enabled: true })

// Supply load options without defaults.
const optionalConfig = await ConfigLoader.getConfig(files, undefined, {
  reload: true,
})
```

The asynchronous and synchronous methods accept `readonly string[]`.
Other static helpers are:

```ts
ConfigLoader.getMainConfigFile(files, process.cwd())
ConfigLoader.getMainConfigFileSync(files, process.cwd())
ConfigLoader.getConfigFiles('/workspace/app.config.ts', ['local', 'dev'])
```

The last call returns the main path followed by environment-specific paths.
The suffix argument also accepts `readonly string[]`.

### Path Helpers

```ts
import { addFileExt, getAbsFiles } from '@eljs/config-loader'

addFileExt('app.config.ts', 'dev') // app.config.dev.ts
getAbsFiles(['app.config.json'], '/workspace') // ['/workspace/app.config.json']
```

## File Formats

| Format     | Extensions      | Async | Sync |
| ---------- | --------------- | ----- | ---- |
| JavaScript | `.js`, `.cjs`   | Yes   | Yes  |
| Native ESM | `.mjs`          | Yes   | No   |
| TypeScript | `.ts`           | Yes   | Yes  |
| JSON       | `.json`         | Yes   | Yes  |
| YAML       | `.yaml`, `.yml` | Yes   | Yes  |

JavaScript module behavior follows the containing package's module type.
Loading `.mjs` synchronously produces `CONFIG_SYNC_FORMAT_UNSUPPORTED`.
TypeScript is transpiled through a short-lived CommonJS transform hook;
relative `.ts` dependencies are supported, while TypeScript path aliases
are not resolved.

## Validation and Reloading

```ts
import { ConfigLoader } from '@eljs/config-loader'

const loader = new ConfigLoader({
  defaultConfigFiles: ['app.config.json'],
  validate(config, context) {
    if (
      !('server' in config) ||
      !config.server ||
      typeof config.server !== 'object'
    ) {
      throw new TypeError('server configuration is required')
    }
    console.log(context.loadedConfigFiles)
    return config
  },
})
```

`context.configFiles` contains all declared input paths.
`context.loadedConfigFiles` contains the files that produced configuration
objects and participated in merging, in merge order.

Configuration roots, defaults, and callback results must be plain objects.
Nested arrays are supported, but root arrays and class instances are not.
Custom `merge` and `validate` callbacks must remain synchronous and return
objects compatible with the caller's declared type.

Set `reload: true` to re-evaluate the asynchronous JavaScript entry module.
Its imported dependencies still follow Node.js module caching. Synchronous
CommonJS entry loading is already fresh. Each ESM reload creates another
module instance, so use reload in controlled development or refresh flows.

## Errors and Execution Boundary

Missing candidates and non-file paths are skipped. Existing files that cannot
be parsed or executed fail the load. Loading, merging, and validation failures
use `ConfigLoadError`; branch on `error.code` rather than its message:

```ts
import { ConfigLoadError } from '@eljs/config-loader'

try {
  await loader.getConfig()
} catch (error) {
  if (error instanceof ConfigLoadError) {
    console.error(error.code, error.configFile, error.cause)
  }
  throw error
}
```

JavaScript and TypeScript configuration executes with the current process
permissions. Only load configuration from trusted locations.

## Development

From the repository root:

```bash
pnpm --filter @eljs/config-loader typecheck
pnpm --filter @eljs/config-loader test
pnpm --filter @eljs/config-loader build
```
