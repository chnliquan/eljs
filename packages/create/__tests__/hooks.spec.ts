import { describe, expect, it } from 'vitest'

import { createHookSchema } from '../src/hooks'

describe('Create Hook Schema', () => {
  it('应该集中声明全部 CreateRunner Hook', () => {
    expect(Object.keys(createHookSchema)).toEqual([
      'addQuestions',
      'modifyPaths',
      'modifyAppData',
      'modifyPrompts',
      'modifyTsConfig',
      'modifyJestConfig',
      'modifyPrettierConfig',
      'onStart',
      'onBeforeGenerateFiles',
      'onGenerateFiles',
      'onGenerateDone',
    ])
    expect(Object.isFrozen(createHookSchema)).toBe(true)
  })
})
