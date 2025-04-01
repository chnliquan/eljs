# @eljs/release

Release npm package easily.

## Installation

```bash
$ pnpm add @eljs/release -D
// or
$ yarn add @eljs/release -D
// ro
$ npm i @eljs/release -D
```

```diff
{
  "scripts": {
+   "release": "release"
  },
  "devDependencies": {
+   "@eljs/release": "^1.0.0"
  }
}
```

## Usage

```bash
$ npm run release [version]
// or
$ npx @eljs/release [version]
```

```bash
Usage: release [options] [version]

Arguments:
  version                              Specify the bump version

Options:
  -v, --version                        Output the current version
  --cwd <cwd>                          Specify the working directory
  --git.independent                    Generate git tag independent
  --no-git.requireClean                Skip git working tree clean check
  --no-git.changelog                   Skip changelog generation
  --no-git.commit                      Skip git commit
  --no-git.push                        Skip git push
  --git.requireBranch <requireBranch>  Require that the release is on a particular branch
  --npm.prerelease                     Specify the release type as prerelease  --npm.canary                         Specify the release type as canary
  --npm.syncCnpm                       Sync to cnpm when release done
  --no-npm.requireOwner                Skip npm owner check
  --no-npm.confirm                      Skip confirm bump version
  --npm.prereleaseId <prereleaseId>    Specify the prereleaseId
  --no-github.release                  Skip the github release step
  -h, --help                           display help for command
```

## Configuration

Create a **release.config.ts** file in the project root.

```ts
export interface Config {
  /**
   * Working directory
   * @default process.cwd()
   */
  cwd?: string
  /**
   * Git config
   */
  git?: {
    /**
     * Whether to require git working tree clean
     * @default true
     */
    requireClean?: boolean
    /**
     * Require that the release is on a particular branch
     */
    requireBranch?: string
    /**
     * Changelog config
     * @default { filename: 'CHANGELOG.md', preset: '@eljs/conventional-changelog-preset' }
     */
    changelog?:
      | false
      | {
          /**
           * Changelog file name
           * @default CHANGELOG.md
           */
          filename?: string
          /**
           * Placeholder for when no changes have been made
           * @default '**Note:** No changes, only version bump.'
           */
          placeholder?: string
          /**
           * Preset of conventional-changelog
           * @link https://github.com/conventional-changelog/conventional-changelog/blob/master/packages/conventional-changelog/README.md#presets
           */
          preset?: string
        }
    /**
     * Whether to generate independent git tags
     * @default false
     */
    independent?: boolean
    /**
     * Whether to commit changes
     * @default true
     */
    commit?: boolean
    /**
     * Commit message
     * @default "chore: bump version v${version}"
     */
    commitMessage?: string
    /**
     * Git commit arguments
     */
    commitArgs?: string[] | string
    /**
     * Whether to push remote
     * @default true
     */
    push?: boolean
    /**
     * Git push arguments
     * @default ['--follow-tags']
     */
    pushArgs?: string[] | string
  }
  /**
   * Npm config
   */
  npm?: {
    /**
     * Whether to require npm owner
     * @default true
     */
    requireOwner?: boolean
    /**
     * Whether to use prerelease type
     */
    prerelease?: boolean
    /**
     * Prerelease id
     */
    prereleaseId?: 'alpha' | 'beta' | 'rc'
    /**
     * Whether to use canary version
     * @default false
     */
    canary?: boolean
    /**
     * Whether to confirm the increment version
     * @default true
     */
    confirm?: boolean
    /**
     * Npm publish arguments
     */
    publishArgs?: string | string[]
    /**
     * Whether to sync cnpm
     * @default false
     */
    syncCnpm?: boolean
  }
  /**
   * Github config
   */
  github?: {
    /**
     * Whether to create a github release
     * @default true
     */
    release?: boolean
  }
  /**
   * Preset definitions
   */
  presets?: PluginDeclaration[]
  /**
   * Plugin definitions
   */
  plugins?: PluginDeclaration[]
}
```
