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
| `@eljs/utils/cli`       | Prompts, pauses, CLI process harness, update notices  |
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

File and template copies accept `destinationRoot` to enforce an output boundary
after filename rendering. The root must exist; descendant symbolic links,
including dangling links, and paths outside the root are rejected before writing.
`basedir` remains a logging option. `resolveWriteDestination()` and its synchronous
counterpart expose the same check for other writes. Callers must keep exclusive
ownership of the output directory until the write finishes.

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

`writeFile()` and `writeFileSync()` accept an encoding string or a Node.js
write options object as their third argument, defaulting to UTF-8. Use
`flag: 'wx'` to create a new file exclusively. If the target already exists,
the error retains its `EEXIST` code and the original content stays intact:

```ts
import { writeFileSync } from '@eljs/utils/file'

writeFileSync('./generated/config.ts', 'export default {}\n', {
  encoding: 'utf8',
  flag: 'wx',
})
```

`writeFileAtomic()` and `writeFileAtomicSync()` also accept encoding strings
or options objects with `encoding`, `mode`, and `flush`. The asynchronous
version accepts `signal` and checks cancellation during writing and before
starting the rename; cancellation cannot roll back a rename already started.
Both helpers replace the target by renaming a temporary file and reject
`flag`: `wx` cannot prevent rename from overwriting the target, and `a`
cannot append to the target.

```ts
import { writeFileAtomic } from '@eljs/utils/file'

await writeFileAtomic('./config.ts', 'export default {}\n', {
  encoding: 'utf8',
  mode: 0o600,
  flush: true,
})
```

`mode` determines the replacement file's permissions. `flush` syncs the
temporary file, not the parent directory's metadata.

Synchronous writes reject `signal` before writing. Use `WriteFileSyncOptions`
and `CopyFileSyncOptions` for synchronous wrappers, and asynchronous helpers
when cancellation is required. JSON writers reject values whose `toJSON()`
produces `undefined` before changing the target.

`readFile()` and `readFileSync()` also accept encoding strings or options
objects. Omitted encodings default to UTF-8 strings. Explicit `null` or
`{ encoding: null }` returns a Buffer; asynchronous reads support `signal`:

```ts
import { readFile, remove } from '@eljs/utils/file'

const bytes = await readFile('./image.png', { encoding: null })
const text = await readFile('./config.ts', {
  signal: AbortSignal.timeout(5000),
})
await remove('./generated', {
  filter: file => !file.endsWith('.keep'),
})
```

`remove()` and `removeSync()` forward rimraf's asynchronous and synchronous
options, including filtering, retries, and cancellation. Synchronous filters
must return a boolean rather than a Promise.

`copyTemplate()`, `copyTemplateSync()`, and template branches of directory
copies accept `writeOptions` for output encoding, write flags, and new file
permissions. For ordinary file copies, `mode` means copy flags such as
`COPYFILE_EXCL`, not file permissions:

```ts
import { copyTemplate } from '@eljs/utils/file'

await copyTemplate(
  './config.ts.tpl',
  './config.ts',
  {},
  {
    writeOptions: { flag: 'wx', mode: 0o600 },
  },
)
```

`loadTs()`, `loadTsSync()`, and `resolveTsConfig()` load TypeScript on demand.
The loader installs a short-lived CommonJS hook to synchronously transpile an
entry and its relative `.ts` dependencies. It does not write generated files or
resolve `paths` aliases. Ordinary file helpers do not load the TypeScript
compiler.

Generator copy methods shallow-merge rendering options: instance fields provide
defaults and per-call fields take precedence. Nested option objects replace
their defaults as a whole. Custom template delimiters also apply to destination
filenames.

`move()` and `moveSync()` use native rename semantics without deleting the
destination first. Same or overlapping paths are rejected. Non-empty directory
replacement preserves compatibility through temporary backup and restoration
on failure; if restoration fails, the error reports the retained backup path.
This fallback is not atomic or crash-recoverable. Cross-device moves propagate
`EXDEV` without deleting the old destination. The no-overwrite check includes
dangling symlinks but is not an atomic reservation against concurrent writers.
Only parent directories are resolved during path validation; a trailing
symbolic link is moved or replaced as a directory entry without following it.

Both JavaScript loaders resolve relative paths against cwd. TypeScript loaders
reject syntax errors before execution, without performing full typechecking.
Unusual thrown values retain their original cause when contextualized.

### Paths, Guards, and Retries

`getWorkspaceRoot()` selects the nearest supported workspace marker regardless
of package manager. `getWorkspacePackageRoots()` takes the configuration
directory, preserves recursive glob patterns and exclusions, and returns only
directories containing `package.json`, excluding `node_modules`. Without
workspace patterns, it retains the single-package fallback to the given
directory. `getCallerDirectory()` returns a filesystem path for both ESM and
CommonJS callers.

`isPromise()` detects thenables and narrows to `PromiseLike<T>`, not a complete
`Promise<T>`. Use `Promise.resolve(value)` when `catch()` or `finally()` is
needed. `isAsyncFunction()` excludes async generators; `isString()` and
`isBoolean()` accept primitive values, not boxed objects.

`retry()` and `retryWithValue()` retain their maximum-attempts semantics:
passing `3` as the second argument means at most three calls, including the
first. The count must be a positive safe integer; delay must be finite and
between zero and 2147483647 milliseconds. Helpers wait only between attempts.
`retryWithValue()` retries nullish results and propagates exceptions immediately.
`timeout()` clears its timer when the task settles; timing out does not cancel
the original task.

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

`run()` and `runCommandLine()` infer result types from their options: `stdout`
defaults to a string, becomes a Uint8Array with `encoding: 'buffer'`, becomes
a string array with `lines: true`, and is `undefined` when stdout is ignored.
Git and npm text query parsers require string output.

Pass a command and its arguments separately. `runCommandLine()` supports only
whitespace separation and backslash escaping; it is not a shell parser and
does not implement pipes, redirects, or variable expansion.

### Interactive Prompts and Downloads

`select()` infers the selected value from typed choices; loosely typed choices
return `unknown`. `confirm()` with a custom cancellation handler can return
`undefined`, preserving the handler's behavior. `loopPrompt()` masks password
and invisible answers in its summary without changing returned values.
`pause()` rejects when input closes before a line is received.

Buffered `download()` checks the byte limit while reading and preserves the
third argument in `download(url, undefined, options)`. Both download helpers
publish ordinary files via temporary-file rename, preserving an existing
regular file's read, write, and execute permissions. Archive extraction writes
into the destination directly and may leave extracted entries on failure.
`downloadNpmTarball()` always extracts with `strip: 1`; its dedicated
`DownloadNpmTarballOptions` omits these fixed settings while remaining
compatible with existing `DownloadOptions` variables.

Downloads follow redirects manually, canceling each intermediate or failed
response body before continuing or closing the proxy. `maxRedirects` defaults
to 20; `0` rejects redirects. HTTPS to HTTP redirects are rejected unless
`allowInsecureRedirects: true` is explicitly set for a trusted legacy endpoint.
Across origins (including changes of port or protocol), only `accept`,
`accept-encoding`, `accept-language`, `user-agent`, and `range` survive from
caller headers. Custom authentication headers, cookies, and authorization
headers are removed and never restored later in the chain. Use a signed
destination URL when a CDN requires authentication. Redirect URLs containing
userinfo or non-HTTP(S) protocols are rejected with `ERR_DOWNLOAD_REDIRECT`.
The entire redirect chain and final body share one timeout, cancellation
signal, and proxy; `maxBytes` still limits the final downloaded content.
Independent response cancellation and proxy cleanup failures are retained
alongside the original error in an `AggregateError`.

`cloneGitRepository()` creates safe `UtilsError` diagnostics instead of
exposing the underlying Execa error. Messages and details omit URL userinfo,
query, and fragment; raw command, output, metadata, and cause graphs are not
retained. Stable process/abort codes, numeric exit codes, and selected system
error codes remain available. Cancellation still terminates the subprocess
but reports `ERR_OPERATION_ABORTED` without retaining the caller's reason.
Owned temporary-directory cleanup failures are sanitized independently and
combined in an `AggregateError`; caller-supplied destinations are retained.

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
