import promptsPlugin from '../../../src/internal/plugins/prompts'
import type { Api } from '../../../src/types'

// Mock types
interface Question {
  name: string
  type: string
}

interface PromptContext {
  questions: Question[]
}

interface PromptMemo {
  $$isFirstTime?: boolean
  gitUrl?: string
  gitHref?: string
  author?: string
  email?: string
  registry?: string
  year?: string
  date?: string
  dateTime?: string
  existingProp?: string
  [key: string]: unknown
}

interface MockUtils {
  prompts: jest.MockedFunction<
    (
      questions: Question[],
      options: { onCancel: () => void },
    ) => Promise<Record<string, unknown>>
  >
}

interface MockChildProcess {
  execSync: jest.MockedFunction<(command: string) => string>
}

interface MockSrcUtils {
  onCancel: jest.MockedFunction<() => void>
}

interface MockInternalUtils {
  author: string
  email: string
  getGitHref: jest.MockedFunction<(gitUrl: string) => string>
}

// Mock @eljs/utils
jest.mock('@eljs/utils', () => ({
  prompts: jest.fn(),
}))

// Mock dayjs
jest.mock('dayjs', () => {
  const mockDayjs = () => ({
    format: jest.fn((format: string) => {
      switch (format) {
        case 'YYYY':
          return '2023'
        case 'YYYY-MM-DD':
          return '2023-12-01'
        case 'YYYY-MM-DD hh:mm:ss':
          return '2023-12-01 10:30:45'
        default:
          return format
      }
    }),
  })
  return mockDayjs
})

// Mock node:child_process
jest.mock('node:child_process', () => ({
  execSync: jest.fn(() => 'https://custom-registry.com\n'),
}))

// Mock utils and internal utils
jest.mock('../../../src/utils', () => ({
  onCancel: jest.fn(),
}))

jest.mock('../../../src/internal/utils', () => ({
  author: 'Test Author',
  email: 'test@example.com',
  getGitHref: jest.fn(() => 'https://github.com/test/repo'),
}))

describe('内部插件 prompts', () => {
  let mockApi: jest.Mocked<Api>
  let firstModifyPromptsCallback: (
    memo: PromptMemo,
    context?: PromptContext,
  ) => Promise<PromptMemo>
  let secondModifyPromptsCallback: (memo: PromptMemo) => PromptMemo
  let mockUtils: MockUtils
  let mockChildProcess: MockChildProcess
  let mockSrcUtils: MockSrcUtils
  let mockInternalUtils: MockInternalUtils

  beforeEach(() => {
    let callbackIndex = 0
    mockUtils = jest.requireMock('@eljs/utils') as MockUtils
    mockChildProcess = jest.requireMock(
      'node:child_process',
    ) as MockChildProcess
    mockSrcUtils = jest.requireMock('../../../src/utils') as MockSrcUtils
    mockInternalUtils = jest.requireMock(
      '../../../src/internal/utils',
    ) as MockInternalUtils

    mockApi = {
      modifyPrompts: jest.fn((callback: unknown) => {
        if (callbackIndex === 0) {
          firstModifyPromptsCallback = callback as (
            memo: PromptMemo,
            context?: PromptContext,
          ) => Promise<PromptMemo>
        } else if (callbackIndex === 1) {
          secondModifyPromptsCallback = callback as (
            memo: PromptMemo,
          ) => PromptMemo
        }
        callbackIndex++
      }),
    } as unknown as jest.Mocked<Api>

    jest.clearAllMocks()
  })

  it('应该是一个函数', () => {
    expect(typeof promptsPlugin).toBe('function')
  })

  it('应该注册两个 modifyPrompts 回调', () => {
    promptsPlugin(mockApi)

    expect(mockApi.modifyPrompts).toHaveBeenCalledTimes(2)
    expect(mockApi.modifyPrompts).toHaveBeenCalledWith(expect.any(Function))
  })

  describe('第一个 modifyPrompts 回调（提示处理）', () => {
    it('不是第一次时应该运行 prompts', async () => {
      mockUtils.prompts.mockResolvedValue({ name: 'test-project' })

      promptsPlugin(mockApi)

      const memo: PromptMemo = {}
      const context: PromptContext = {
        questions: [{ name: 'name', type: 'text' }],
      }

      const result = await firstModifyPromptsCallback(memo, context)

      expect(mockUtils.prompts).toHaveBeenCalledWith(context.questions, {
        onCancel: mockSrcUtils.onCancel,
      })
      expect(result).toEqual({
        $$isFirstTime: true,
        name: 'test-project',
      })
    })

    it('已经是第一次时应该跳过 prompts', async () => {
      promptsPlugin(mockApi)

      const memo: PromptMemo = { $$isFirstTime: true, existingData: 'value' }
      const context: PromptContext = {
        questions: [{ name: 'name', type: 'text' }],
      }

      const result = await firstModifyPromptsCallback(memo, context)

      expect(mockUtils.prompts).not.toHaveBeenCalled()
      expect(result).toEqual(memo)
    })

    it('应该将现有 memo 与 prompt 答案合并', async () => {
      mockUtils.prompts.mockResolvedValue({
        name: 'test-project',
        version: '1.0.0',
      })

      promptsPlugin(mockApi)

      const memo: PromptMemo = { existingProp: 'value' }
      const context: PromptContext = { questions: [] }

      const result = await firstModifyPromptsCallback(memo, context)

      expect(result).toEqual({
        $$isFirstTime: true,
        existingProp: 'value',
        name: 'test-project',
        version: '1.0.0',
      })
    })
  })

  describe('第二个 modifyPrompts 回调（数据处理）', () => {
    it('应该添加默认模板变量', () => {
      promptsPlugin(mockApi)

      const memo: PromptMemo = {}
      const result = secondModifyPromptsCallback(memo)

      expect(result).toEqual({
        author: 'Test Author',
        email: 'test@example.com',
        gitUrl: '{{gitUrl}}',
        gitHref: '{{gitHref}}',
        registry: 'https://custom-registry.com',
        year: '2023',
        date: '2023-12-01',
        dateTime: '2023-12-01 10:30:45',
      })
    })

    it('应该使用有效的 git URL 并分析 href', () => {
      mockInternalUtils.getGitHref.mockReturnValue(
        'https://github.com/test/repo',
      )

      promptsPlugin(mockApi)

      const memo: PromptMemo = { gitUrl: 'https://github.com/test/repo.git' }
      const result = secondModifyPromptsCallback(memo)

      expect(mockInternalUtils.getGitHref).toHaveBeenCalledWith(
        'https://github.com/test/repo.git',
      )
      expect(result.gitUrl).toBe('https://github.com/test/repo.git')
      expect(result.gitHref).toBe('https://github.com/test/repo')
    })

    it('对于无效的 git URL 应该使用占位符', () => {
      promptsPlugin(mockApi)

      // invalid-url 不以 git 或 http 开头，所以应该使用占位符
      const memo: PromptMemo = { gitUrl: 'invalid-url' }
      const result = secondModifyPromptsCallback(memo)

      // memo 值被保留，但使用处理后的 href 值
      expect(result.gitUrl).toBe('invalid-url')
      expect(result.gitHref).toBe('{{gitHref}}')
    })

    it('对于空的 git URL 应该使用占位符', () => {
      promptsPlugin(mockApi)

      const memo: PromptMemo = { gitUrl: '' }
      const result = secondModifyPromptsCallback(memo)

      expect(result.gitUrl).toBe('')
      expect(result.gitHref).toBe('{{gitHref}}')
    })

    it('对于 github 项目应该使用默认 npm registry', () => {
      promptsPlugin(mockApi)

      const memo: PromptMemo = { gitUrl: 'https://github.com/test/repo.git' }
      const result = secondModifyPromptsCallback(memo)

      expect(result.registry).toBe('https://registry.npmjs.org')
    })

    it('对于非 github 项目应该使用自定义 registry', () => {
      // Mock getGitHref 返回 gitlab href
      mockInternalUtils.getGitHref.mockReturnValue(
        'https://gitlab.com/test/repo',
      )

      promptsPlugin(mockApi)

      const memo: PromptMemo = { gitUrl: 'https://gitlab.com/test/repo.git' }
      const result = secondModifyPromptsCallback(memo)

      // 应该使用 npm registry，因为 gitlab href 不包含 'github'
      expect(result.registry).toBe('https://custom-registry.com')
    })

    it('应该优雅地处理 npm config 错误', () => {
      mockChildProcess.execSync.mockImplementation(() => {
        throw new Error('npm not found')
      })

      promptsPlugin(mockApi)

      const memo: PromptMemo = { gitUrl: 'https://gitlab.com/test/repo.git' }

      // 不应该抛出异常
      expect(() => secondModifyPromptsCallback(memo)).not.toThrow()
    })

    it('应该保留现有的 memo 属性', () => {
      promptsPlugin(mockApi)

      const memo: PromptMemo = {
        existingProp: 'value',
        author: 'Original Author', // 应该被保留，因为 memo 覆盖默认值
      }
      const result = secondModifyPromptsCallback(memo)

      expect(result.existingProp).toBe('value')
      expect(result.author).toBe('Original Author') // memo 值应该被保留
    })

    it('应该正确格式化日期', () => {
      promptsPlugin(mockApi)

      const memo: PromptMemo = {}
      const result = secondModifyPromptsCallback(memo)

      expect(result.year).toBe('2023')
      expect(result.date).toBe('2023-12-01')
      expect(result.dateTime).toBe('2023-12-01 10:30:45')
    })

    it('当 getGitHref 返回 falsy 值时应该使用占位符', () => {
      mockInternalUtils.getGitHref.mockReturnValue('')

      promptsPlugin(mockApi)

      const memo: PromptMemo = { gitUrl: 'https://github.com/test/repo.git' }
      const result = secondModifyPromptsCallback(memo)

      expect(mockInternalUtils.getGitHref).toHaveBeenCalledWith(
        'https://github.com/test/repo.git',
      )
      expect(result.gitUrl).toBe('https://github.com/test/repo.git')
      expect(result.gitHref).toBe('{{gitHref}}')
    })
  })

  it('处理 prompts 时不应该抛出异常', () => {
    expect(() => promptsPlugin(mockApi)).not.toThrow()
  })
})
