import { describe, expect, it } from 'vitest'

import { releaseHookSchema } from '../src/hooks'

describe('Release Hook Schema', () => {
  it('应该集中声明全部 ReleaseRunner Hook', () => {
    expect(Object.keys(releaseHookSchema)).toEqual([
      'modifyConfig',
      'modifyAppData',
      'onCheck',
      'onStart',
      'getIncrementVersion',
      'onBeforeBumpVersion',
      'onBumpVersion',
      'onAfterBumpVersion',
      'getChangelog',
      'onBeforeRelease',
      'onRelease',
      'onAfterRelease',
    ])
    expect(Object.isFrozen(releaseHookSchema)).toBe(true)
  })
})
