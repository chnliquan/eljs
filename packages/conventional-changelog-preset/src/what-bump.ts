import type { PresetCommit, WhatBumpResult } from './types.js'

/**
 * 根据原始提交推断版本提升，破坏性变更优先于新功能，其他提交默认提升补丁版本
 *
 * @internal
 */
export function whatBump(commits: PresetCommit[]): WhatBumpResult {
  let level: WhatBumpResult['level'] = 2
  let breakings = 0
  let features = 0

  commits.forEach(commit => {
    if (commit.notes.length > 0) {
      breakings += commit.notes.length
      level = 0
    } else if (commit.type === 'feat') {
      features += 1
      if (level === 2) {
        level = 1
      }
    }
  })

  return {
    level,
    reason:
      breakings === 1
        ? `There is ${breakings} BREAKING CHANGE and ${features} features`
        : `There are ${breakings} BREAKING CHANGES and ${features} features`,
  }
}
