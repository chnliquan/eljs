import type { UserConfig } from '@eljs/pluggable'

import type { PrereleaseId } from './npm'

/**
 * Release Configuration
 */
export interface Config extends UserConfig {
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
}
