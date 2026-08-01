import type { UserConfig } from '@eljs/plugin-host'

import type { PrereleaseId } from './npm'

/**
 * Release Configuration
 */
export interface Config extends UserConfig {
  /**
   * Working directory
   * @defaultValue `process.cwd()`
   */
  cwd?: string
  /**
   * Git config
   */
  git?: {
    /**
     * Whether to require git working tree clean
     * @defaultValue `true`
     */
    requireClean?: boolean
    /**
     * Require that the release is on a particular branch
     */
    requireBranch?: string
    /**
     * Changelog config
     * @defaultValue `{ filename: 'CHANGELOG.md', preset: '@eljs/conventional-changelog-preset' }`
     */
    changelog?:
      | false
      | {
          /**
           * Changelog file name
           * @defaultValue `CHANGELOG.md`
           */
          filename?: string
          /**
           * Placeholder for when no changes have been made
           * @defaultValue `'**Note:** No changes, only version bump.'`
           */
          placeholder?: string
          /**
           * Preset of conventional-changelog
           *
           * {@link https://github.com/conventional-changelog/conventional-changelog/blob/master/packages/conventional-changelog/README.md#presets}
           */
          preset?: string
        }
    /**
     * Whether to generate independent git tags
     * @defaultValue `false`
     */
    independent?: boolean
    /**
     * Whether to commit changes
     * @defaultValue `true`
     */
    commit?: boolean
    /**
     * Commit message
     * @defaultValue `"chore: bump version v${version}"`
     */
    commitMessage?: string
    /**
     * Git commit arguments
     */
    commitArgs?: string[] | string
    /**
     * Whether to push remote
     * @defaultValue `true`
     */
    push?: boolean
    /**
     * Git push arguments
     * @defaultValue `['--follow-tags']`
     */
    pushArgs?: string[] | string
  }
  /**
   * Npm config
   */
  npm?: {
    /**
     * Whether to require npm owner
     * @defaultValue `true`
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
     * @defaultValue `false`
     */
    canary?: boolean
    /**
     * Whether to confirm the increment version
     * @defaultValue `true`
     */
    confirm?: boolean
    /**
     * Npm publish arguments
     */
    publishArgs?: string | string[]
  }
  /**
   * Github config
   */
  github?: {
    /**
     * Whether to create a github release
     * @defaultValue `true`
     */
    release?: boolean
  }
}
