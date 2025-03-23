# @eljs/release

Release npm package easily

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
  version                              Specify the bump version.

Options:
  -v, --version                        Output the current version.
  --cwd <cwd>                          Specify the working directory.
  --git.independent                    Generate git tag independent.
  --no-git.requireClean                Skip check git working tree clean.
  --no-git.changelog                   Skip generate changelog.
  --no-git.commit                      Skip the commit release step.
  --no-git.push                        Skip the push release step.
  --git.requireBranch <requireBranch>  Require that the release is on a particular branch.
  --npm.prerelease                     Specify the release type as prerelease.
  --npm.canary                         Specify the release type as canary.
  --npm.cnpm                           Sync to cnpm when release done.
  --no-npm.requireOwner                Skip check npm owner step.
  --no-npm.confirm                      Skip the confirm bump version release step.
  --npm.prereleaseId <prereleaseId>    Specify the prereleaseId.
  --no-github.release                  Skip the github release step.
  -h, --help                           display help for command
```

## Configuration

create a **release.config.ts** file in the project root

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
     * Whether commit changes
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
     * Whether push to remote
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
    prereleaseId?: PrereleaseId
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
    cnpm?: boolean
  }
  /**
   * Github config
   */
  github?: {
    /**
     * Whether to release github
     * @default true
     */
    release?: boolean
  }
  /**
   * Preset Definition Collection
   */
  presets?: PluginDeclaration[]
  /**
   * Plugin Definition Collection
   */
  plugins?: PluginDeclaration[]
}
```
