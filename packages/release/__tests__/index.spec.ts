import { describe, expect, it } from 'vitest'

import * as releaseIndex from '../src/index'

describe('release 消费者入口契约', () => {
  it('仅暴露发布入口、插件契约、默认值和结构化错误', () => {
    expect(Object.keys(releaseIndex).sort()).toEqual(
      [
        'AppError',
        'ReleasePublishError',
        'ReleaseRunnerStage',
        'defaultConfig',
        'defineConfig',
        'definePlugin',
        'definePreset',
        'release',
        'releaseHookSchema',
      ].sort(),
    )
  })

  it('调用方能够按公开错误类型处理发布进度', () => {
    const error = new releaseIndex.ReleasePublishError({
      failedPackage: '@example/ui',
      version: '2.0.0',
      publishedPackages: ['@example/core'],
      unpublishedPackages: ['@example/ui'],
    })

    expect(error).toBeInstanceOf(releaseIndex.AppError)
    expect(error.details.publishedPackages).toEqual(['@example/core'])
    expect(Object.isFrozen(error.details)).toBe(true)
  })
})
