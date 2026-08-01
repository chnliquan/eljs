# @eljs/release

Powerful and flexible npm package release tool with comprehensive automation support.

[![NPM Version](https://img.shields.io/npm/v/@eljs/release.svg)](https://www.npmjs.com/package/@eljs/release)
[![NPM Downloads](https://img.shields.io/npm/dm/@eljs/release.svg)](https://www.npmjs.com/package/@eljs/release)
[![License](https://img.shields.io/npm/l/@eljs/release.svg)](https://github.com/chnliquan/eljs/blob/master/LICENSE)

## ✨ Features

- 🚀 **Dual Usage** - Support both CLI and programmatic API usage
- 📦 **Smart Version Management** - Automatic semantic versioning with validation
- 📝 **Changelog Generation** - Automatic changelog generation using conventional commits
- 🔐 **NPM Publishing** - Secure npm publishing with owner validation
- 🧪 **Safe Preview** - Validate and preview a release with `--dry-run`
- 🧩 **Monorepo Aware** - Publish workspace packages in runtime dependency order
- ⚙️ **Highly Configurable** - Flexible configuration with presets and plugins
- 🎯 **Type Safety** - Full TypeScript support with comprehensive type definitions
- 🔧 **Plugin System** - Extensible plugin architecture for custom workflows

## 📦 Installation

```bash
# Using pnpm (recommended)
pnpm add @eljs/release -D

# Using yarn
yarn add @eljs/release -D

# Using npm
npm install @eljs/release -D
```

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
import { release, ReleaseRunner, defineConfig } from '@eljs/release'

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

| Option                         | Description                                             | Default            |
| ------------------------------ | ------------------------------------------------------- | ------------------ |
| `-v, --version`                | Output the current version                              | -                  |
| `--cwd <cwd>`                  | Specify the working directory                           | `process.cwd()`    |
| `--dry-run`                    | Preview without publishing or modifying project files   | `false`            |
| `--git.independent`            | Generate git tag independent                            | `false`            |
| `--no-git.requireClean`        | Skip git working tree clean check                       | `true`             |
| `--no-git.changelog`           | Skip changelog generation                               | `true`             |
| `--no-git.commit`              | Skip git commit                                         | `true`             |
| `--no-git.push`                | Skip git push                                           | `true`             |
| `--git.requireBranch <branch>` | Require that the release is on a particular branch      | -                  |
| `--npm.prerelease`             | Specify the release type as prerelease                  | `false`            |
| `--npm.canary`                 | Specify the release type as canary                      | `false`            |
| `--npm.registry <registry>`    | Use one registry for queries, owner checks, and publish | package/npm config |
| `--no-npm.requireOwner`        | Skip npm owner check                                    | `true`             |
| `--npm.networkConcurrency <n>` | Limit concurrent npm registry requests                  | `8`                |
| `--no-npm.confirm`             | Skip confirm bump version                               | `true`             |
| `--npm.prereleaseId <id>`      | Specify a prerelease ID such as alpha/beta/rc/next      | -                  |
| `--no-github.release`          | Skip GitHub Release creation                            | `true`             |
| `--github.mode <mode>`         | Create GitHub Release through `browser` or `api`        | `browser`          |
| `-h, --help`                   | Display help for command                                | -                  |

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
```

## 📖 API Reference

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
import { ReleaseRunner } from '@eljs/release'

async function betaRelease() {
  const runner = new ReleaseRunner({
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

  await runner.run()
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
the unchanged release commit, for example `release 1.2.3`. Do not rerun a
relative bump such as `release patch`, because it may calculate a newer
version. This also works when the first package failed before any package was
published. Packages already present in the registry are verified against the
local tag and skipped; the remaining packages are then published before the
commit and tags are pushed.

Programmatic callers can inspect `ReleasePublishError.details` for
`failedPackage`, `publishedPackages`, and `unpublishedPackages`. Do not amend,
delete, or move the local release tag before retrying.

Automatic recovery relies on the default `git.commit: true` workflow. When Git
commits and tags are disabled, reconcile any partially published package set
manually before starting another release.

Manifest and lockfile updates are transactional within the built-in version
plugin. If lockfile generation fails, all changed manifests and supported
lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lock`, and
legacy `bun.lockb`) are restored before the error is reported.

## 📦 Package Manager Compatibility

The root `packageManager` declaration is authoritative, with workspace
lockfiles used as a fallback. npm, pnpm, Yarn Classic, Yarn Berry, and Bun are
supported. Yarn Berry is distinguished by the declaration or `.yarnrc.yml`, so it uses
`yarn npm publish` and `yarn install --mode=update-lockfile`; Yarn Classic uses
`yarn publish`. Bun 1.2+ `bun.lock` and legacy `bun.lockb` are both detected.
When Yarn Berry is used, any manifest `publishConfig.registry` must match an
explicit `npm.registry`, because Yarn gives the manifest value precedence.

## 🧑‍💻 Development

From the repository root:

```bash
pnpm install
pnpm --filter @eljs/release lint
pnpm --filter @eljs/release typecheck
pnpm --filter @eljs/release test
pnpm --filter @eljs/release build
```

The project requires Node.js 22.14 or newer and uses pnpm. Persistent settings
can be placed in `release.config.ts` or `release.config.js` at the target root.
