# @eljs/generator

[简体中文](./README.zh-CN.md)

Extensible project generation from local, npm, and Git templates, with CLI
and programmatic APIs.

[![NPM Version](https://img.shields.io/npm/v/@eljs/generator.svg)](https://www.npmjs.com/package/@eljs/generator)
[![License](https://img.shields.io/npm/l/@eljs/generator.svg)](https://github.com/chnliquan/eljs/blob/master/LICENSE)

Use this package to run your own template or build a project generator with
plugins. For official template selection, use [`@eljs/create`](../create).
For local prompting and file-writing primitives, use `@eljs/utils/generator`.

## Runtime Requirements

- Node.js 22.14 or newer
- ESM and CommonJS entries with TypeScript declarations
- Registry or Git access when using remote templates

## Installation

```bash
# Programmatic use and template development.
pnpm add @eljs/generator

# Optional global CLI installation.
pnpm add --global @eljs/generator
```

## Quick Start

```bash
# Generate from a local template.
npx @eljs/generator ./my-template my-project

# Generate from an npm template or a Git repository.
npx @eljs/generator @company/project-template my-project
npx @eljs/generator https://github.com/user/template.git#main my-project
```

Templates configure the generation flow and can register custom questions,
file-writing hooks, and post-generation tasks.

### A Complete Local Template

Create this directory:

```text
my-template/
├── create.config.ts
├── plugins/
│   └── files.ts
└── templates/
    └── index.ts.tpl
```

`my-template/create.config.ts`:

```ts
import { defineConfig } from '@eljs/generator'

export default defineConfig({
  defaultQuestions: false,
  gitInit: false,
  install: false,
  plugins: ['./plugins/files.ts'],
})
```

`my-template/plugins/files.ts`:

```ts
import { definePlugin } from '@eljs/generator'
import { join } from 'node:path'

export default definePlugin(context => {
  context.onGenerateFiles(async () => {
    await context.copyTpl(
      join(context.paths.cwd, 'templates/index.ts.tpl'),
      context.resolve('src/index.ts'),
      { projectName: context.appData.projectName },
    )
  })
})
```

`my-template/templates/index.ts.tpl`:

```ts
export const projectName = '{{ projectName }}'
```

Run `npx @eljs/generator ./my-template my-project`. The plugin writes
`my-project/src/index.ts`; the template disables default prompts, Git
initialization, and dependency installation. Template files use Mustache by
default; enable EJS explicitly with `renderOptions: { type: 'ejs' }` in the
copying options.

### Programmatic Usage

```ts
import { ProjectGenerator } from '@eljs/generator'

const generator = new ProjectGenerator({
  template: './my-template',
  cwd: process.cwd(),
})

await generator.run('my-project')
```

`ProjectGeneratorOptions` requires a `template`; other options control
generation and directory handling. `constructorOptions` is a read-only
snapshot, `cwd` exposes the working directory, and `template` exposes the
current template declaration.

## CLI

```bash
generator [options] <template> <project-name>
```

| Option                       | Description                                              | Default         |
| ---------------------------- | -------------------------------------------------------- | --------------- |
| `--cwd <cwd>`                | Working directory                                        | `process.cwd()` |
| `-f, --force`                | Replace an existing target directory                     | `false`         |
| `-m, --merge`                | Merge generated output into an existing target directory | `false`         |
| `--install` / `--no-install` | Install project dependencies after generation            | `true`          |
| `-y, --yes`                  | Confirm execution of the selected remote template        | `false`         |
| `--allow-template-scripts`   | Allow lifecycle scripts in remote template dependencies  | `false`         |
| `-v, --version`              | Print the generator version                              | —               |
| `-h, --help`                 | Print command help                                       | —               |

Explicit CLI options override template configuration, which overrides built-in
defaults. An omitted `--install` leaves the template's setting in effect.

## Template Configuration

`create.config.ts` or `create.config.js` is loaded from the template root after
the source and target have been resolved. Source selection and directory
handling belong in `ProjectGeneratorOptions`; the template configuration
controls generation:

```ts
import { defineConfig } from '@eljs/generator'

export default defineConfig({
  defaultQuestions: true,
  gitInit: true,
  install: true,
  presets: ['@company/generator-preset'],
  plugins: ['./plugins/files.ts'],
})
```

`ResolvedConfig` makes only fields with built-in defaults required.
Template sources, `merge`, plugin declarations, and optional remote-template
fields remain optional.

Plugins and presets use the `@eljs/plugin-host` lifecycle. Initialization
registers hooks; it must not access `context.config`, `context.paths`,
`context.appData`, or `context.prompts` before those values are resolved.
Read runtime values inside the appropriate hook callback.

```ts
import { definePlugin } from '@eljs/generator'
import { join } from 'node:path'

export default definePlugin(context => {
  context.addQuestions(() => [
    { type: 'text', name: 'authorName', message: 'Author name' },
  ])

  context.extendPackage(pkg => ({
    ...pkg,
    author: context.prompts.authorName,
  }))

  context.onGenerateFiles(async () => {
    await context.copyDirectory(
      join(context.paths.cwd, 'templates'),
      context.paths.target,
      {
        ...context.prompts,
        ...context.appData,
      },
    )
  })
})
```

`extendPackage` queues changes during initialization and applies callbacks
after prompts and project metadata are available. Generated files complete
before post-generation hooks run.

## Generator Capabilities

| Method                                            | Purpose                                                                |
| ------------------------------------------------- | ---------------------------------------------------------------------- |
| `context.resolve(...paths)`                       | Resolve a path under the project target                                |
| `context.copyFile(from, to, options?)`            | Copy a file                                                            |
| `context.copyTpl(from, to, data, options?)`       | Render and copy one template file                                      |
| `context.copyDirectory(from, to, data, options?)` | Copy and render a directory                                            |
| `context.render(path, data?, options?)`           | Render a file or directory relative to the calling plugin              |
| `context.extendPackage(extension)`                | Merge an object or callback result into the generated package manifest |
| `context.install(args?, options?)`                | Install dependencies in the generated project                          |

Await asynchronous copying and installation inside hook callbacks so the
runner can finish them before advancing the lifecycle. File-writing
capabilities enforce the project output boundary. Resolve template-relative
source paths from `context.paths.cwd`; `context.resolve()` resolves output
paths from the target directory.

## Remote Sources

```ts
import { ProjectGenerator } from '@eljs/generator'

const generator = new ProjectGenerator({
  template: {
    type: 'npm',
    value: '@company/project-template@1.0.0',
    registry: 'https://registry.npmjs.org',
  },
})

await generator.run('my-project')
```

`RemoteTemplate` supports:

| Field        | Contract                                                              |
| ------------ | --------------------------------------------------------------------- |
| `type`       | `npm` or `git`                                                        |
| `value`      | npm package specifier or Git repository address                       |
| `registry?`  | Registry URL for npm templates                                        |
| `integrity?` | Expected npm tarball SRI digest; ignored for Git                      |
| `trusted?`   | Skip remote execution confirmation for a source trusted by the caller |

### Template Execution and Integrity

Templates are executable code and run with the current process permissions.
Unknown remote templates require confirmation before downloading and
executing. `yes: true` or `trusted: true` skips that confirmation; neither
setting isolates template execution.

Remote template dependency lifecycle scripts are disabled by default.
`allowTemplateScripts: true` enables them. This setting is separate from
`install`, which controls the generated project's dependency installation.

npm downloads inherit project and user `.npmrc` authentication and proxy
settings. Credentials are matched to the destination host and path rather
than forwarded to unrelated tarball hosts. Downloads are limited to 100 MiB
and 20,000 extracted entries.

An explicit `integrity` digest validates independently supplied expected
bytes; otherwise registry integrity or shasum is used. Wrappers following
`latest` can omit a separate digest. Wrappers pinning exact template versions
can pin a digest and update it with each template release.

## Directory Transactions and Cancellation

`force` and `merge` are mutually exclusive. Existing output is backed up
before generation and restored if generation fails. Successful generation
keeps the new output and removes the backup. A target lock prevents
cooperating processes from writing the same physical directory concurrently.
Interrupted runs leave recovery metadata for the next invocation.
If releasing the acquisition mutex fails before a lock reaches its caller,
the transaction not yet returned to the caller is handed off as `recovery-pending`
before the stopped mutex is handed off. The original operation error takes
precedence over a release error. After the filesystem fault is removed, a
retry can recover in the same process; backup paths and recovery direction
remain recorded. Unreadable or changed ownership is never forcibly removed.
If the handoff itself cannot be persisted, the original records remain for
safe recovery after the owner exits or manual inspection.

See [transaction and recovery details](https://github.com/chnliquan/eljs/blob/master/docs/generator-recovery.md)
for state ordering, recovery errors, and filesystem limits.

```ts
const controller = new AbortController()
const generator = new ProjectGenerator({
  template: './my-template',
  signal: controller.signal,
})

process.once('SIGINT', () => controller.abort())
await generator.run('my-project')
```

Cancellation is checked at downloading, plugin, and generation boundaries.
Creation errors use `AppError` and stable `CREATE_*` codes, exported from the
root and `@eljs/generator/errors`.

## Development

From the repository root:

```bash
pnpm --filter @eljs/generator... build
pnpm --filter @eljs/generator typecheck
pnpm exec vitest run packages/generator/__tests__
DEBUG=generator:* pnpm exec generator ./my-template my-project
```
