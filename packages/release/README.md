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
+   "@eljs/release": "^1.4.0"
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
import { release, Runner, defineConfig } from '@eljs/release'

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

| Option                         | Description                                        | Default         |
| ------------------------------ | -------------------------------------------------- | --------------- |
| `-v, --version`                | Output the current version                         | -               |
| `--cwd <cwd>`                  | Specify the working directory                      | `process.cwd()` |
| `--git.independent`            | Generate git tag independent                       | `false`         |
| `--no-git.requireClean`        | Skip git working tree clean check                  | `true`          |
| `--no-git.changelog`           | Skip changelog generation                          | `true`          |
| `--no-git.commit`              | Skip git commit                                    | `true`          |
| `--no-git.push`                | Skip git push                                      | `true`          |
| `--git.requireBranch <branch>` | Require that the release is on a particular branch | -               |
| `--npm.prerelease`             | Specify the release type as prerelease             | `false`         |
| `--npm.canary`                 | Specify the release type as canary                 | `false`         |
| `--no-npm.requireOwner`        | Skip npm owner check                               | `true`          |
| `--no-npm.confirm`             | Skip confirm bump version                          | `true`          |
| `--npm.prereleaseId <id>`      | Specify the prereleaseId (alpha/beta/rc)           | -               |
| `--no-github.release`          | Skip the github release step                       | `true`          |
| `-h, --help`                   | Display help for command                           | -               |

### CLI Examples

```bash
# Standard patch release
release patch

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
     * Whether to require npm owner validation
     * @default true
     */
    requireOwner: true,
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
    /**
     * Whether to sync cnpm registry
     * @default false
     */
    syncCnpm: false,
  },
  /**
   * GitHub configuration
   */
  github: {
    /**
     * Whether to create a github release
     * @default true
     */
    release: true,
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

Extend release functionality with custom plugins:

```typescript
import { defineConfig } from '@eljs/release'

export default defineConfig({
  plugins: [
    // Custom plugin
    {
      name: 'slack-notification',
      async apply(context) {
        context.hooks.afterRelease.tap('slack', async result => {
          await sendSlackNotification(`Released ${result.version}`)
        })
      },
    },
    // Plugin with options
    {
      name: 'custom-validation',
      options: {
        checkTests: true,
        checkLinting: true,
      },
      async apply(context) {
        context.hooks.beforeRelease.tap('validation', async () => {
          await runCustomValidation(this.options)
        })
      },
    },
  ],
})
```

## 📝 Usage Examples

### Basic Monorepo Setup

```typescript
// packages/core/release.config.ts
import { defineConfig } from '@eljs/release'

export default defineConfig({
  git: {
    independent: true, // Independent versioning
    commitMessage: 'release(core): v${version}',
    changelog: {
      filename: '../../CHANGELOG.md', // Root changelog
    },
  },
  npm: {
    publishArgs: ['--access', 'public', '--tag', 'latest'],
  },
})
```

### Custom Prerelease Workflow

```typescript
import { Runner } from '@eljs/release'

async function betaRelease() {
  const runner = new Runner({
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
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 18
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: npm ci

      - name: Release
        run: npx @eljs/release ${{ github.event.inputs.version }} --no-npm.confirm
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```
