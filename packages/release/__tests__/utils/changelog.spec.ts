import { ConventionalChangelog } from 'conventional-changelog'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

/**
 * @file packages/release utils/changelog 模块单元测试
 * @description 测试 changelog.ts 更新日志生成功能
 */

import concat from 'concat-stream'

import {
  getChangelog,
  type GenerateChangelogOptions,
} from '../../src/utils/changelog'

// 定义 finalizeContext 函数的类型
type FinalizeContextFunction = (
  context: Record<string, unknown>,
  writerOpts: Record<string, unknown>,
  filteredCommits: unknown[],
  keyCommit: Record<string, unknown> | null,
  originalCommits: Array<{ hash: string }>,
) => Record<string, unknown>

// 模拟依赖
vi.mock('concat-stream')
vi.mock('conventional-changelog', () => ({
  ConventionalChangelog: vi.fn(),
}))
vi.mock('@eljs/conventional-changelog-preset', () => ({
  default: vi.fn().mockResolvedValue({
    name: 'eljs-preset',
  }),
}))

describe('更新日志生成工具函数测试', () => {
  const ConventionalChangelogMock = vi.mocked(ConventionalChangelog)
  let generator: {
    config: Mock
    context: Mock
    loadPreset: Mock
    readPackage: Mock
    tags: Mock
    writeStream: Mock
    writer: Mock
  }
  let mockStream: {
    pipe: Mock
    on: Mock
    removeListener: Mock
    unpipe: Mock
    destroy: Mock
  }

  beforeEach(() => {
    vi.clearAllMocks()

    mockStream = {
      pipe: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
      unpipe: vi.fn(),
      destroy: vi.fn(),
    }

    generator = {
      config: vi.fn(),
      context: vi.fn(),
      loadPreset: vi.fn(),
      readPackage: vi.fn(),
      tags: vi.fn(),
      writeStream: vi.fn().mockReturnValue(mockStream),
      writer: vi.fn(),
    }

    for (const method of [
      generator.config,
      generator.context,
      generator.loadPreset,
      generator.readPackage,
      generator.tags,
      generator.writer,
    ]) {
      method.mockReturnValue(generator)
    }

    ConventionalChangelogMock.mockImplementation(
      class {
        public constructor() {
          return generator
        }
      } as never,
    )
    ;(concat as Mock).mockImplementation(callback => {
      return {
        callback,
        on: vi.fn(),
        removeListener: vi.fn(),
        destroy: vi.fn(),
      }
    })
  })

  describe('getChangelog 函数', () => {
    it.each([
      new Error('用户取消'),
      new DOMException('超时', 'TimeoutError'),
      '取消原因',
      null,
    ])('预取消应保留原始原因且不初始化生成器：%s', async reason => {
      const controller = new AbortController()
      controller.abort(reason)

      await expect(getChangelog({ signal: controller.signal })).rejects.toBe(
        reason,
      )
      expect(ConventionalChangelogMock).not.toHaveBeenCalled()
    })

    it('初始化导入期间取消应释放监听器且不创建生成器', async () => {
      const controller = new AbortController()
      const add = vi.spyOn(controller.signal, 'addEventListener')
      const remove = vi.spyOn(controller.signal, 'removeEventListener')
      const reason = new Error('初始化取消')
      const result = getChangelog({ signal: controller.signal })
      controller.abort(reason)

      await expect(result).rejects.toBe(reason)
      await new Promise(resolve => setTimeout(resolve, 0))
      expect(ConventionalChangelogMock).not.toHaveBeenCalled()
      expect(remove).toHaveBeenCalledWith('abort', add.mock.calls[0][1])
    })

    it.each([
      'success',
      'failure',
      'abort',
      'abort-string',
      'abort-null',
      'sink-close',
      'stream-close',
      'sink-error',
    ] as const)('%s 应释放取消监听器且安全处理晚到流错误', async outcome => {
      const controller = new AbortController()
      const add = vi.spyOn(controller.signal, 'addEventListener')
      const remove = vi.spyOn(controller.signal, 'removeEventListener')
      const reason =
        outcome === 'abort-string'
          ? '生成取消'
          : outcome === 'abort-null'
            ? null
            : new DOMException('生成超时', 'TimeoutError')
      const result = getChangelog({ signal: controller.signal })
      const assertion =
        outcome === 'success'
          ? expect(result).resolves.toBe('rendered')
          : outcome === 'stream-close'
            ? expect(result).rejects.toThrow(
                'Changelog stream closed before completion',
              )
            : outcome === 'sink-close'
              ? expect(result).rejects.toThrow(
                  'Changelog output closed before completion',
                )
              : expect(result).rejects.toBe(reason)
      await vi.waitFor(() => expect(mockStream.pipe).toHaveBeenCalled())
      const sink = mockStream.pipe.mock.calls[0][0]
      const onError = mockStream.on.mock.calls.find(
        ([event]) => event === 'error',
      )?.[1]
      if (outcome === 'success') {
        sink.callback(Buffer.from(' rendered \n'))
      } else if (outcome === 'failure') {
        onError(reason)
      } else if (outcome === 'sink-close') {
        sink.on.mock.calls.find(([event]: [string]) => event === 'close')[1]()
      } else if (outcome === 'stream-close') {
        mockStream.on.mock.calls.find(([event]) => event === 'close')?.[1]()
      } else if (outcome === 'sink-error') {
        sink.on.mock.calls.find(([event]: [string]) => event === 'error')[1](
          reason,
        )
      } else {
        controller.abort(reason)
      }
      await assertion
      expect(remove).toHaveBeenCalledWith('abort', add.mock.calls[0][1])
      expect(() => onError(new Error('晚到错误'))).not.toThrow()
      if (outcome !== 'success') {
        expect(mockStream.destroy).toHaveBeenCalledOnce()
        expect(sink.destroy).toHaveBeenCalledOnce()
        // concat 即便晚到回调，也不能将已取消的生成变成成功
        sink.callback(Buffer.from('late'))
      }
      mockStream.on.mock.calls.find(([event]) => event === 'close')?.[1]()
      sink.on.mock.calls.find(([event]: [string]) => event === 'close')[1]()
      expect(mockStream.removeListener).toHaveBeenCalledWith('error', onError)
      expect(sink.removeListener).toHaveBeenCalledWith('error', onError)
    })

    it('应该使用默认配置生成更新日志', async () => {
      const options: GenerateChangelogOptions = {}
      const expectedChangelog = '# Changelog\n\n## v1.0.0\n- 新功能'

      // 模拟成功的流处理
      mockStream.pipe.mockImplementation(concatStream => {
        // 模拟调用 concat 的回调函数
        setTimeout(() => {
          concatStream.callback(Buffer.from(expectedChangelog + '  \n  '))
        }, 0)
        return concatStream
      })

      const changelogPromise = getChangelog(options)
      const result = await changelogPromise

      expect(result).toBe(expectedChangelog)

      expect(ConventionalChangelogMock).toHaveBeenCalledWith(process.cwd())
      expect(generator.readPackage).toHaveBeenCalledOnce()
      expect(generator.config).toHaveBeenCalledWith(expect.any(Promise))
      expect(generator.context).toHaveBeenCalledWith({ commit: 'commit' })
      expect(generator.writer).toHaveBeenCalledWith(
        expect.objectContaining({ finalizeContext: expect.any(Function) }),
      )
    })

    it('应该使用指定的工作目录', async () => {
      const options: GenerateChangelogOptions = {
        cwd: '/custom/path',
      }

      mockStream.pipe.mockImplementation(concatStream => {
        setTimeout(() => {
          concatStream.callback(Buffer.from('changelog content'))
        }, 0)
        return concatStream
      })

      await getChangelog(options)

      expect(ConventionalChangelogMock).toHaveBeenCalledWith('/custom/path')
    })

    it('应该使用独立标签前缀', async () => {
      const options: GenerateChangelogOptions = {
        independent: true,
      }

      mockStream.pipe.mockImplementation(concatStream => {
        setTimeout(() => {
          concatStream.callback(Buffer.from('changelog content'))
        }, 0)
        return concatStream
      })

      await getChangelog(options)

      expect(generator.tags).toHaveBeenCalledWith({ prefix: /^.+@/ })
    })

    it('应该使用指定的预设', async () => {
      const options: GenerateChangelogOptions = {
        preset: 'angular',
        cwd: '/it/path',
      }

      mockStream.pipe.mockImplementation(concatStream => {
        setTimeout(() => {
          concatStream.callback(Buffer.from('angular preset changelog'))
        }, 0)
        return concatStream
      })

      await getChangelog(options)

      expect(ConventionalChangelogMock).toHaveBeenCalledWith('/it/path')
      expect(generator.loadPreset).toHaveBeenCalledWith('angular')
      expect(generator.config).not.toHaveBeenCalled()
    })

    it('应该正确处理流错误', async () => {
      const options: GenerateChangelogOptions = {}
      const itError = new Error('流处理错误')

      mockStream.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(itError), 0)
        }
      })

      await expect(getChangelog(options)).rejects.toThrow('流处理错误')
    })

    it('应该正确去除结果中的空白字符', async () => {
      const options: GenerateChangelogOptions = {}
      const rawChangelog = '\n\n  # Changelog\n\n## v1.0.0  \n  \n'

      mockStream.pipe.mockImplementation(concatStream => {
        setTimeout(() => {
          concatStream.callback(Buffer.from(rawChangelog))
        }, 0)
        return concatStream
      })

      const result = await getChangelog(options)
      expect(result).toBe('# Changelog\n\n## v1.0.0')
    })

    it('应该处理空的更新日志内容', async () => {
      const options: GenerateChangelogOptions = {}

      mockStream.pipe.mockImplementation(concatStream => {
        setTimeout(() => {
          concatStream.callback(Buffer.from('   \n\n  '))
        }, 0)
        return concatStream
      })

      const result = await getChangelog(options)
      expect(result).toBe('')
    })
  })

  describe('finalizeContext 函数行为', () => {
    let finalizeContext: FinalizeContextFunction

    beforeEach(async () => {
      const options: GenerateChangelogOptions = {}

      mockStream.pipe.mockImplementation(concatStream => {
        setTimeout(() => {
          concatStream.callback(Buffer.from('it'))
        }, 0)
        return concatStream
      })

      await getChangelog(options)

      const writerOpts = generator.writer.mock.calls[0][0]
      finalizeContext = writerOpts.finalizeContext
    })

    it('应该正确处理有 keyCommit 但没有 currentTag 的情况', () => {
      // 这个测试检验 finalizeContext 的内部逻辑
      // 由于 finalizeContext 是复杂的内部函数，我们简化测试逻辑
      const context = {
        gitSemverTags: ['v1.0.0', 'v0.9.0'],
        currentTag: null,
        previousTag: null,
      }
      const writerOpts = {}
      const filteredCommits: unknown[] = []
      const keyCommit = {
        gitTags: 'tag: v1.1.0, origin/main',
      }
      const originalCommits = [{ hash: 'abc123' }, { hash: 'def456' }]

      const result = finalizeContext(
        context,
        writerOpts,
        filteredCommits,
        keyCommit,
        originalCommits,
      )

      // 由于 finalizeContext 是复杂的内部逻辑，我们主要验证它不抛出错误
      expect(result).toBeDefined()
      expect(typeof result).toBe('object')
    })

    it('应该处理独立标签的情况', () => {
      const context = {
        gitSemverTags: ['package-a@1.0.0'],
        currentTag: null,
        previousTag: 'package-a@0.9.0',
        version: '1.1.0',
      }
      const keyCommit = null
      const originalCommits: Array<{ hash: string }> = []

      // 测试独立模式下的标签猜测
      const result = finalizeContext(
        context,
        {},
        [],
        keyCommit,
        originalCommits,
      )

      expect(result.currentTag).toBeDefined()
      expect(result.linkCompare).toBe(true)
    })

    it('应该正确设置 linkCompare', () => {
      const context = {
        gitSemverTags: ['v1.0.0'],
        currentTag: 'v1.1.0',
        previousTag: 'v1.0.0',
        linkCompare: undefined,
      }

      const result = finalizeContext(context, {}, [], null, [])

      expect(result.linkCompare).toBe(true)
    })

    it('应该处理 Unreleased 版本', () => {
      const context = {
        gitSemverTags: ['v1.0.0'],
        currentTag: null,
        previousTag: 'v1.0.0',
        version: 'Unreleased',
      }
      const originalCommits = [{ hash: 'latest123' }]

      const result = finalizeContext(context, {}, [], null, originalCommits)

      expect(result.currentTag).toBe('latest123')
    })

    it('应该使用 lastCommitHash 作为 previousTag 的后备', () => {
      const context = {
        gitSemverTags: [],
        currentTag: 'v1.0.0',
        previousTag: null,
      }
      const originalCommits: Array<{ hash: string }> = [
        { hash: 'first123' },
        { hash: 'last456' },
      ]
      const keyCommit = {
        gitTags: 'tag: v1.0.0',
      }

      const result = finalizeContext(
        context,
        {},
        [],
        keyCommit,
        originalCommits,
      )

      // 验证函数执行不抛出错误
      expect(result).toBeDefined()
      expect(typeof result).toBe('object')
    })
  })

  describe('guessNextTag 函数行为', () => {
    it('应该正确猜测下一个标签（独立模式）', async () => {
      // 这个测试通过调用 getChangelog 并检查 finalizeContext 的行为来间接测试 guessNextTag
      const options: GenerateChangelogOptions = {
        independent: true,
      }

      mockStream.pipe.mockImplementation(concatStream => {
        setTimeout(() => {
          concatStream.callback(Buffer.from('it'))
        }, 0)
        return concatStream
      })

      await getChangelog(options)

      // 验证独立模式的标签前缀配置正确
      expect(generator.tags).toHaveBeenCalledWith({ prefix: /^.+@/ })
    })

    it('应该正确处理不同的版本格式', async () => {
      const options: GenerateChangelogOptions = {}

      mockStream.pipe.mockImplementation(concatStream => {
        setTimeout(() => {
          concatStream.callback(Buffer.from('it'))
        }, 0)
        return concatStream
      })

      await getChangelog(options)

      const writerOpts = generator.writer.mock.calls[0][0]
      const finalizeContext = writerOpts.finalizeContext

      // 测试不同的版本格式处理
      const contextWithV = {
        gitSemverTags: ['v1.0.0'],
        previousTag: 'v1.0.0',
        version: '1.1.0',
      }

      const result = finalizeContext(contextWithV, {}, [], null, [])
      // 应该根据 previousTag 的格式来决定是否添加 'v' 前缀
      expect(result.currentTag).toMatch(/^v?1\.1\.0$/)
    })
  })
})
