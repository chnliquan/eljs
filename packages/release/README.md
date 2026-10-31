# @eljs/release

[简体中文](./README.zh-CN.md)

A programmable npm release workflow for versioning, changelogs, GitHub, and
ordered workspace publishing.

[![NPM Version](https://img.shields.io/npm/v/@eljs/release.svg)](https://www.npmjs.com/package/@eljs/release)
[![NPM Downloads](https://img.shields.io/npm/dm/@eljs/release.svg)](https://www.npmjs.com/package/@eljs/release)
[![License](https://img.shields.io/npm/l/@eljs/release.svg)](https://github.com/chnliquan/eljs/blob/master/LICENSE)

## ✨ Features

- 🚀 **Dual Usage** - Support both CLI and programmatic API usage
- 📦 **Version Management** - Semantic version suggestions from commits and explicit version validation
- 📝 **Changelog Generation** - Automatic changelog generation using conventional commits
- 🔐 **NPM Publishing** - Registry and package ownership checks before publishing
- 🧪 **Safe Preview** - Validate and preview a release with `--dry-run`
- 🧩 **Monorepo Aware** - Publish workspace packages in runtime dependency order
- ⚙️ **Configuration** - Release configuration files, presets, and plugins
- 🎯 **TypeScript APIs** - Typed release options and plugin contexts
- 🔧 **Plugin System** - Extensible plugin architecture for custom workflows

## 📦 Installation

Published packages require Node.js 22.14 or newer.

```bash
# Using pnpm (recommended)
pnpm add @eljs/release -D

# Using yarn
yarn add @eljs/release -D

# Using npm
npm install @eljs/release -D
```

When installed globally or invoked through `npx @eljs/release`, use the
`release` command.

## 🚀 Quick Start

### CLI Usage (Recommended)

Add to your `package.json`:

```diff
{
  "scripts": {
+   "release": "release"
  },
  "devDependencies": {
+   "@eljs/release": "latest"
  }
}
```

Basic usage:

```bash
# Release with interactive version selection
npm run release

# Release with specific version
npm run release 1.2.3
npm run release patch
npm run release minor
npm run release major

# Using npx directly
npx @eljs/release patch
```

### Programmatic API Usage

```typescript
import { release, defineConfig } from '@eljs/release'

// Simple release
await release('patch')

// Release with custom options
await release('1.2.3', {
  git: {
    changelog: false,
    push: false,
  },
  npm: {
    prerelease: true,
    prereleaseId: 'beta',
  },
})
```

## 📖 CLI Reference

### Commands

```bash
release [options] [version]
```

### Arguments

| Argument  | Description                                                                 |
| --------- | --------------------------------------------------------------------------- |
| `version` | Specify the bump version (patch/minor/major or specific version like 1.2.3) |

### Options

| Option                                         | Description                                             | Default            |
| ---------------------------------------------- | ------------------------------------------------------- | ------------------ |
| `-v, --version`                                | Output the current version                              | -                  |
| `--cwd <cwd>`                                  | Specify the working directory                           | `process.cwd()`    |
| `--dry-run`                                    | Preview without publishing or modifying project files   | `false`            |
| `--git.independent` / `--no-git.independent`   | Generate one git tag per workspace package              | `false`            |
| `--git.requireClean` / `--no-git.requireClean` | Check git working tree is clean                         | `true`             |
| `--git.commit` / `--no-git.commit`             | Commit version and changelog changes                    | `true`             |
| `--git.push` / `--no-git.push`                 | Push commit and tags to remote                          | `true`             |
| `--git.requireBranch <branch>`                 | Require that the release is on a particular branch      | -                  |
| `--retry`                                      | Retry the release version from the release tag at HEAD  | `false`            |
| `--npm.prerelease` / `--no-npm.prerelease`     | Specify the release type as prerelease                  | `false`            |
| `--npm.canary` / `--no-npm.canary`             | Specify the release type as canary                      | `false`            |
| `--npm.registry <registry>`                    | Use one registry for queries, owner checks, and publish | package/npm config |
| `--npm.requireOwner` / `--no-npm.requireOwner` | Require npm ownership of all packages                   | `true`             |
| `--npm.confirm` / `--no-npm.confirm`           | Confirm bump version before publish                     | `true`             |
| `--npm.prereleaseId <id>`                      | Specify a prerelease ID such as alpha/beta/rc/next      | -                  |
| `--github.release` / `--no-github.release`     | Create GitHub Release                                   | `true`             |
| `--github.mode <mode>`                         | Create GitHub Release through `browser` or `api`        | `browser`          |
| `-h, --help`                                   | Display help for command                                | -                  |

`--dry-run` previews the built-in workflow without publishing or modifying
project files. Custom plugin hooks still execute and must check
`context.config.dryRun` before performing their own side effects.

To disable changelog generation, set `git.changelog: false` in
`release.config.ts` or pass it to the programmatic API:

```ts
import { defineConfig } from '@eljs/release'

export default defineConfig({
  git: { changelog: false },
})
```

#### Precedence

Options explicitly passed on the command line always override the
`release.config.ts` file, which in turn overrides built-in defaults:
`CLI > release.config.ts > defaults`. Both positive and negative forms are
accepted for boolean options; when the same option is passed multiple times,
the last occurrence wins.

### CLI Examples

```bash
# Standard patch release
release patch

# Validate the entire plan without modifying files or publishing
release patch --dry-run

# Major release with custom working directory
release major --cwd ./packages/core

# Prerelease with beta tag
release --npm.prerelease --npm.prereleaseId beta

# Release without git operations
release minor --no-git.commit --no-git.push

# Release on specific branch with custom settings
release patch --git.requireBranch main --no-npm.confirm

# Enable push even when release.config.ts sets git.push to false
release patch --git.push

# Disable independent tags even when release.config.ts enables them
release minor --no-git.independent
```

## 📖 API Reference

The package root exports `release`, `defineConfig`, `definePlugin`,
`definePreset`, `defaultConfig`, `releaseHookSchema`, `ReleaseRunnerStage`,
`AppError`, and `ReleasePublishError`, together with their configuration,
plugin-context, application-data, and error-detail types. The runner and
command, version, Git, and manifest helpers are internal implementation details.

### `release(version?, options?)`

Main release function for programmatic usage.

```typescript
async function release(version?: string, options?: Config): Promise<void>
```

**Parameters:**

- `version` (optional): Version to bump to (patch/minor/major or specific version)
- `options` (optional): Configuration options

**Example:**

```typescript
import { release } from '@eljs/release'

// Interactive release
await release()

// Specific version
await release('2.0.0')

// With custom config
await release('patch', {
  git: {
    requireClean: false,
    changelog: {
      filename: 'HISTORY.md',
      preset: 'angular',
    },
  },
  npm: {
    canary: true,
  },
})
```

## ⚙️ Configuration

Create a **release.config.ts** file in your project root for persistent configuration:

```typescript
import { defineConfig } from '@eljs/release'

export default defineConfig({
  /**
   * Working directory
   * @default process.cwd()
   */
  cwd: process.cwd(),
  /**
   * Validate and preview without writing manifests/changelog/lockfiles,
   * creating commits/tags, publishing packages, pushing, or opening GitHub
   * @default false
   */
  dryRun: false,
  /**
   * Git configuration
   */
  git: {
    /**
     * Whether to require git working tree clean
     * @default true
     */
    requireClean: true,
    /**
     * Require that the release is on a particular branch
     */
    requireBranch: 'main',
    /**
     * Changelog configuration
     * @default { filename: 'CHANGELOG.md', preset: '@eljs/conventional-changelog-preset' }
     */
    changelog: {
      filename: 'CHANGELOG.md',
      placeholder: '**Note:** No changes, only version bump.',
      preset: '@eljs/conventional-changelog-preset',
    },
    /**
     * Whether to generate independent git tags
     * @default false
     */
    independent: false,
    /**
     * Whether to commit changes
     * @default true
     */
    commit: true,
    /**
     * Commit message template
     * @default "chore: bump version v${version}"
     */
    commitMessage: 'chore: bump version v${version}',
    /**
     * Git commit arguments
     */
    commitArgs: ['--no-verify'],
    /**
     * Whether to push to remote
     * @default true
     */
    push: true,
    /**
     * Git push arguments
     * @default ['--follow-tags']
     */
    pushArgs: ['--follow-tags', '--atomic'],
  },
  /**
   * NPM configuration
   */
  npm: {
    /**
     * Registry used consistently for metadata, owner checks, and publish
     * @default package publishConfig.registry or npm configuration
     */
    registry: 'https://registry.npmjs.org',
    /**
     * Whether to require npm owner validation
     * @default true
     */
    requireOwner: true,
    /**
     * Maximum concurrent registry requests
     * @default 8
     */
    networkConcurrency: 8,
    /**
     * Whether to use prerelease type
     */
    prerelease: false,
    /**
     * Prerelease identifier
     */
    prereleaseId: 'beta',
    /**
     * Whether to use canary version
     * @default false
     */
    canary: false,
    /**
     * Whether to confirm the increment version
     * @default true
     */
    confirm: true,
    /**
     * NPM publish arguments
     */
    publishArgs: ['--access', 'public'],
  },
  /**
   * GitHub configuration
   */
  github: {
    /**
     * Whether to create a GitHub Release after publish and push
     * @default true
     */
    release: true,
    /**
     * Open a prefilled browser page or create the release through REST API
     * @default 'browser'
     */
    mode: 'browser',
    /**
     * Environment variable containing the API token
     * @default 'GITHUB_TOKEN'
     */
    tokenEnv: 'GITHUB_TOKEN',
  },
  /**
   * Custom presets
   */
  presets: [],
  /**
   * Custom plugins
   */
  plugins: [],
})
```

API mode sends tokens to `github.com` by default. For GitHub Enterprise, set
`github.enterpriseHost` to the remote's exact lowercase hostname (for example,
`git.corp.example.com`); protocols, ports, and paths are rejected.

## 🔌 Plugin System

Extend release functionality with plugin entry modules. Plugin-specific options are passed as the
second item of the declaration tuple:

Plugin hooks still run during `--dry-run` so that they can validate and preview their work. Built-in
plugins avoid side effects automatically; custom plugins must check `context.config.dryRun` before
writing files, publishing data, sending notifications, or changing external state.

```typescript
// release.config.ts
import { defineConfig } from '@eljs/release'

export default defineConfig({
  plugins: [
    [
      './plugins/custom-validation.ts',
      {
        checkTests: true,
        checkLinting: true,
      },
    ],
    './plugins/slack-notification.ts',
  ],
})
```

```typescript
// plugins/custom-validation.ts
import { definePlugin } from '@eljs/release'

interface ValidationOptions {
  checkTests: boolean
  checkLinting: boolean
}

export default definePlugin<ValidationOptions>(
  (
    context,
    options = {
      checkTests: true,
      checkLinting: true,
    },
  ) => {
    context.onBeforeRelease(async () => {
      await runCustomValidation(options)
    })
  },
)
```

```typescript
// plugins/slack-notification.ts
import { definePlugin } from '@eljs/release'

export default definePlugin(context => {
  context.onAfterRelease(async result => {
    if (context.config.dryRun) {
      return
    }

    await sendSlackNotification(`Released ${result.version}`)
  })

  context.onError(async ({ error, stage }) => {
    if (context.config.dryRun) {
      return
    }

    await reportReleaseFailure({ error, stage })
  })
})
```

## 📝 Usage Examples

### Basic Monorepo Setup

```typescript
// release.config.ts in the workspace root
import { defineConfig } from '@eljs/release'

export default defineConfig({
  git: {
    independent: true, // Package-specific tags; package versions remain aligned
    commitMessage: 'release: v${version}',
    changelog: {
      filename: 'CHANGELOG.md',
    },
  },
  npm: {
    publishArgs: ['--access', 'public', '--tag', 'latest'],
  },
})
```

### Custom Prerelease Workflow

```typescript
import { release } from '@eljs/release'

async function betaRelease() {
  await release(undefined, {
    npm: {
      prerelease: true,
      prereleaseId: 'beta',
      confirm: false,
      publishArgs: ['--tag', 'beta'],
    },
    git: {
      commitMessage: 'chore: beta release v${version}',
      push: false, // Don't push beta releases
    },
    github: {
      release: false, // No GitHub release for betas
    },
  })
}

betaRelease()
```

### CI/CD Integration

```yaml
# .github/workflows/release.yml
name: Release
on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to release'
        required: true
        type: choice
        options: ['patch', 'minor', 'major']

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: 22.14.0
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: npm ci

      - name: Release
        run: >-
          npx @eljs/release "$ELJS_RELEASE_VERSION"
          --no-npm.confirm --github.mode api
        env:
          GITHUB_TOKEN: ${{ github.token }}
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
          ELJS_RELEASE_VERSION: ${{ github.event.inputs.version }}
```

API mode creates releases idempotently: an existing release with the same tag
is reused. The token needs repository Contents write permission. Browser mode
remains the default for local use; if the browser cannot be opened, the command
prints the prefilled URL and keeps the completed publication successful.

## 🛟 Failure Recovery

The release commit and tags stay local until every package is published. If a
workspace publish stops partway through, rerun the exact target version from
the unchanged release commit, for example `release 1.2.3`, or run
`release --retry` to discover the failed version from the release tag at HEAD
automatically. Do not rerun a
relative bump such as `release patch`, because it may calculate a newer
version. This also works when the first package failed before any package was
published. Packages already present in the registry are verified against the
local tag and skipped; the remaining packages are then published before the
commit and tags are pushed.

Independent retry only considers tags for currently publishable workspace
packages. Missing package tags are allowed, but matched tags must identify one
version. Unified retry also rejects conflicting `v<version>` tags rather than
choosing the highest version.

Programmatic callers can inspect `ReleasePublishError.details` for
`failedPackage`, `publishedPackages`, and `unpublishedPackages`. Do not amend,
delete, or move the local release tag before retrying.

Automatic recovery relies on the default `git.commit: true` workflow. When Git
commits and tags are disabled, reconcile any partially published package set
manually before starting another release.

Before entering the built-in Git commit or publish command, failure or cancellation
restores built-in manifest, lockfile and changelog changes, including original
bytes, permissions and existence. Supported lockfiles include `package-lock.json`,
`pnpm-lock.yaml`, `yarn.lock`, `bun.lock` and legacy `bun.lockb`. Newly created empty
changelog directories are removed; unrelated custom Hook files remain intact.
Once the commit or publish call begins, rollback is disabled because that command
may have completed a side effect even if it reports failure.

## 📦 Package Manager Compatibility

The root `packageManager` declaration is authoritative, with workspace
lockfiles used as a fallback. npm, pnpm, Yarn Classic, Yarn Berry, and Bun are
supported. Yarn Berry is distinguished by the declaration or `.yarnrc.yml`, so it uses
`yarn npm publish` and `yarn install --mode=update-lockfile`; Yarn Classic uses
`yarn publish`. Bun 1.2+ `bun.lock` and legacy `bun.lockb` are both detected.
When Yarn Berry is used, any manifest `publishConfig.registry` must match an
explicit `npm.registry`, because Yarn gives the manifest value precedence.
The registry fixed during version preflight is checked again before committing
and before each publish, including manifest declarations changed by Hooks.
Berry declarations must match that fixed address (trailing slashes are ignored).
For other managers, a fixed CLI registry overrides manifest declarations, so
different overridden values are allowed. If no registry was fixed, introducing
a manifest registry later is rejected; configure `npm.registry` before releasing.

After all `onBeforeRelease` Hooks, disk manifests are checked before the Git
commit, then checked again before each package is published. pnpm's
`publishConfig.directory` is checked as the effective publish directory. Prepare
its manifest in `onBeforeRelease` when building publish artifacts; the check does
not run `pack` or lifecycle scripts. It guarantees the manifest state before the
command starts, without locking the final tarball or external filesystem writers.
`dryRun` uses the in-memory plan and does not require built artifacts.

All four dependency fields in the effective publish manifest are checked:
`dependencies`, `optionalDependencies`, `devDependencies`, and `peerDependencies`.
Explicit workspace ranges must be valid and contain the target version;
workspace aliases, relative references, and `*`/`^`/`~` placeholders retain their
existing meaning. Ordinary internal semver ranges must also be valid and contain
the unified release version: version updates normally replace these ranges with
that version, so stale artifact ranges are rejected. `*` remains allowed for
prereleases; other ranges follow standard semver prerelease matching. External
source protocols such as `npm:`, `file:`, `link:`, Git and tarball URLs are preserved
without imposing the unified version on their external targets.
Private workspace packages are not release artifacts: ordinary dev/peer ranges
need only be valid, while explicit workspace ranges must match their actual
manifest version. Runtime dependencies on private workspace packages remain rejected.

`publishArgs` cannot override the registry, publish directory, workspace selection
or version. Registry overrides include scoped settings, configuration-file
selectors such as `--userconfig`, and pnpm `--config.*` options. Configure the
registry through `npm.registry`. Values for other unknown options must use the
`--option=value` form. Target restrictions also apply to normalized option
names, including multi-hyphen forms such as `---workspace`.
Known target-changing aliases and abbreviations such as `--w`, `--ws`, `--C`,
and `--prefi` are also rejected, as are workspace-root inclusion options,
pnpm `-F`, and `--workspace-packages`. npm's lowercase `-f` remains available.
Extra `--dry-run` options are rejected, including false/negated values, normalized
forms such as `---DRY_RUN`, and abbreviations such as `--dry`, `--dr`, and `-d`.
Use top-level `dryRun` (or CLI `--dry-run`) for the only supported preview contract;
a package-manager preview must never be recorded as a successful publication.
Help, usage, and version-display options are also rejected, including normalized,
negated, and abbreviated forms such as `---HELP`, `--no-usage`, `--ver`, and `-v`.
npm publishes with `--dry-run=false --usage=false`; pnpm uses `--dry-run=false`
and overrides inherited `npm_config_usage` for versions that delegate to npm.
These settings override project `.npmrc` and environment preview/usage settings.
Yarn Classic, Yarn Berry, and Bun keep their existing commands without receiving
npm-only configuration flags.

Publish commands do not echo their arguments or stream subprocess output to
logs, because OTP values and registry URLs may contain credentials. Publish
errors retain structured progress and a safe `cause` with exit codes, recognized
error codes, and cancellation status; raw command errors, output, and original
cause chains are discarded. Owner checks and `isVersionExist` failures use the
same safe diagnostics. Missing-version/404 queries still return `false`; other
query failures throw a new safe error without the original sensitive cause.
Version queries explicitly request JSON `name` and `version` fields and disable
npm usage output. Only an object matching both requested fields confirms existence;
help text, invalid JSON, and mismatched identities throw safe errors and cannot
cause retry to skip a package. Empty output retains the existing `false` result.

Changelog generation receives the runner's cancellation signal. The exported
`getChangelog({ cwd, signal })` helper also supports cancellation: an already
aborted signal starts no Git process, and cancellation waits for active Git
processes to close before rejecting with the signal's original reason.

## 🧑‍💻 Development

From the repository root:

```bash
pnpm install
pnpm --filter @eljs/release lint
pnpm --filter @eljs/release typecheck
pnpm --filter @eljs/release test
pnpm --filter @eljs/release build
```

Repository development requires Node.js 22.18 or newer and pnpm 11.20.0.
Persistent settings can be placed in `release.config.ts` or `release.config.js`
at the target root.
