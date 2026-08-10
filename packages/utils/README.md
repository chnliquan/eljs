# @eljs/utils

[简体中文](./README.zh-CN.md)

Domain-based TypeScript primitives for Node.js tooling, project generators,
and automation. The package covers files, child processes, HTTP downloads,
Git, package managers, loaders, paths, logging, and shared types.

[![NPM Version](https://img.shields.io/npm/v/@eljs/utils.svg)](https://www.npmjs.com/package/@eljs/utils)
[![License](https://img.shields.io/npm/l/@eljs/utils.svg)](https://github.com/chnliquan/eljs/blob/master/LICENSE)

## Runtime Requirements

- Node.js `>=22.14.0`
- Windows, macOS, and Linux
- ESM, CommonJS, and TypeScript declarations

`sudo()` requires the system `sudo` executable and is therefore unavailable on
Windows, where it returns `ERR_UNSUPPORTED_PLATFORM`. CI verifies the remaining
cross-platform APIs on Windows, macOS, and Linux.

## Installation

```bash
pnpm add @eljs/utils
```

npm and Yarn are also supported.

## Preferred Imports

New code should import from a domain subpath so it loads only the relevant
module graph:

```ts
import { run } from '@eljs/utils/cp'
import { readJson, writeJsonAtomic } from '@eljs/utils/file'
import { downloadTo } from '@eljs/utils/http'
import type { PackageJson } from '@eljs/utils/types'
```

The root entry remains available for compatibility:

```ts
import { logger, readJson, run } from '@eljs/utils'
```

Import third-party libraries from their owning packages instead of relying on
indirect re-exports from `@eljs/utils`.

## Public Entry Points

| Subpath                 | Responsibility                                        |
| ----------------------- | ----------------------------------------------------- |
| `@eljs/utils/cli`       | Confirmation, pauses, and interactive prompts         |
| `@eljs/utils/cp`        | Commands, executable lookup, PID lookup, and sudo     |
| `@eljs/utils/env`       | Global installation and environment capabilities      |
| `@eljs/utils/error`     | `UtilsError` and stable error codes                   |
| `@eljs/utils/file`      | File reads, writes, copies, moves, and templates      |
| `@eljs/utils/generator` | Template generator lifecycle                          |
| `@eljs/utils/git`       | Git metadata, status, and common operations           |
| `@eljs/utils/guards`    | Runtime type guards                                   |
| `@eljs/utils/http`      | Bounded downloads, streaming writes, and extraction   |
| `@eljs/utils/loader`    | JavaScript, TypeScript, JSON, and YAML loading        |
| `@eljs/utils/logger`    | CLI logging and debug adapters                        |
| `@eljs/utils/module`    | Module lookup and synchronous loading                 |
| `@eljs/utils/npm`       | npm metadata, package managers, and tarball downloads |
| `@eljs/utils/object`    | Object merging                                        |
| `@eljs/utils/path`      | Cross-platform paths and workspace lookup             |
| `@eljs/utils/promise`   | Deferred values, retries, and timers                  |
| `@eljs/utils/string`    | Common string conversions                             |
| `@eljs/utils/types`     | Shared public TypeScript types                        |

Only these domain entries are public. Internal file paths such as
`file/loader` are not compatibility contracts.

## Scope Boundaries

`@eljs/utils` contains reusable mechanisms for multiple Node.js tools, not
product workflows or domain policy.

- General file, process, download, Git, npm, and path primitives belong here
- Project generation, release orchestration, plugin lifecycle, and config
  policy stay in their owning domain packages
- Third-party dependencies are not re-exported merely to create one import path
- A domain should become a separate package when it gains independent
  consumers, a security boundary, or its own release cadence

## Common Examples

### Files and Loaders

```ts
import { copyDirectory, readJson, writeJsonAtomic } from '@eljs/utils/file'
import { loadYaml } from '@eljs/utils/loader'

interface Config {
  output: string
}

const packageJson = await readJson('./package.json')
const config = await loadYaml<Config>('./project.yaml')

await copyDirectory('./template', config.output, {
  packageName: packageJson.name,
})
await writeJsonAtomic('./generated/meta.json', { generated: true })
```

`loadTs()`, `loadTsSync()`, and `resolveTsConfig()` load TypeScript on demand.
The loader installs a short-lived CommonJS hook to synchronously transpile an
entry and its relative `.ts` dependencies. It does not write generated files or
resolve `paths` aliases. Ordinary file helpers do not load the TypeScript
compiler.

### Child Processes

```ts
import { findExecutable, run } from '@eljs/utils/cp'

const git = await findExecutable('git')

if (!git) {
  throw new Error('Git is required')
}

const result = await run(git, ['status', '--short'], {
  cwd: process.cwd(),
  signal: AbortSignal.timeout(30_000),
})

console.log(result.stdout)
```

Pass a command and its arguments separately. `runCommandLine()` supports only
whitespace separation and backslash escaping; it is not a shell parser and
does not implement pipes, redirects, or variable expansion.

## API Naming Changes

Compatibility aliases with ambiguous behavior have been removed. Use the
current names when upgrading older code:

| Current name                | Removed name            |
| --------------------------- | ----------------------- |
| `createTempDir`             | `tmpdir`                |
| `createTempDirSync`         | `tmpdirSync`            |
| `statPath` / `statPathSync` | `fstat` / `fstatSync`   |
| `pathExists`                | `isPathExists`          |
| `writeFileAtomic`           | `safeWriteFile`         |
| `writeJsonAtomic`           | `safeWriteJson`         |
| `copyTemplate`              | `copyTpl`               |
| `findExecutable`            | `getExecutableCommand`  |
| `findProcessId`             | `getPid`                |
| `parseCommandLine`          | `parseCommand`          |
| `runCommandLine`            | `runCommand`            |
| `cloneGitRepository`        | `downloadGitRepository` |
| `parseGitRemoteUrl`         | `gitUrlAnalysis`        |
| `parsePackageSpecifier`     | `pkgNameAnalysis`       |
| `findExistingPath`          | `tryPaths`              |
| `getCallerDirectory`        | `extractCallDir`        |
| `toPosixPath`               | `winPath`               |

`createTempDirSync()` is synchronous. Remove any `await` that older code used
with `tmpdirSync()`.

### Bounded Downloads and Streaming Extraction

```ts
import { download, downloadTo } from '@eljs/utils/http'

// Small response: return a Buffer with a 100 MiB default limit
const manifest = await download('https://example.com/manifest.json', {
  maxBytes: 1024 * 1024,
})

// Large response: stream directly into extraction without buffering it all
await downloadTo('https://example.com/package.tgz', './package', {
  extract: true,
  strip: 1,
  maxBytes: 500 * 1024 * 1024,
  maxEntries: 20_000,
  integrity: 'sha512-<base64-digest>',
  signal: AbortSignal.timeout(30_000),
})

console.log(manifest.byteLength)
```

`maxBytes: 0` and `maxEntries: 0` disable their limits and should be used only
when the caller already controls resource size. `integrity` uses SRI format and
returns `ERR_DOWNLOAD_INTEGRITY` on mismatch.

### Structured Errors

```ts
import { run } from '@eljs/utils/cp'
import { UtilsError } from '@eljs/utils/error'

try {
  await run('node', ['--version'], { verbose: true })
} catch (error) {
  if (error instanceof UtilsError) {
    console.error(error.code, error.operation, error.details)
  }
  throw error
}
```

Downloads and sudo expose stable error codes. Lower-level third-party errors
may still propagate unchanged when an API has not normalized them.

## Development

Run from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm --filter @eljs/utils typecheck
pnpm exec vitest run packages/utils
pnpm --filter @eljs/utils build
```

Build output is written to `packages/utils/dist` with ESM, CommonJS, and type
declaration files. Before submitting changes, also run:

```bash
pnpm exec eslint packages/utils/src packages/utils/__tests__ --max-warnings=0
pnpm exec prettier --check packages/utils
```

## Design Rules

- New public APIs require Chinese TSDoc and regression tests
- An async API resolves only after its underlying I/O or process lifecycle ends
- Windows paths must not assume `/` or `:` as platform separators
- Downloads, processes, and external inputs should prefer stable
  `UtilsError` codes at trust boundaries
- Logging remains lightweight and does not embed a monitoring backend or
  transport layer
- New capabilities are exposed through domain entries, not internal file paths

## License

[MIT](../../LICENSE)
