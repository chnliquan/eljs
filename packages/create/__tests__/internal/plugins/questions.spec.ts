import * as mockedPath from 'node:path'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mocked,
  type MockedFunction,
} from 'vitest'
import questionsPlugin from '../../../src/internal/plugins/questions'
import * as mockedInternalUtils from '../../../src/internal/utils'
import type { CreatePluginContext } from '../../../src/types'

// Mock types
interface QuestionConfig {
  name: string
  type: string
  message: string
  initial?: string
}

interface SelectQuestionConfig {
  type: string
  name: string
  message: string
  choices: Array<{ title: string; value: string }>
  initial: number
}

interface DescribeConfig {
  key: string
  enable: () => boolean
}

interface MockPath {
  basename: MockedFunction<(path: string) => string | undefined>
}

interface MockInternalUtils {
  author: string
  email: string
  getGitUrl: MockedFunction<(targetDir: string) => string>
}

// Mock node:path
vi.mock('node:path', async importOriginal => {
  const original = await importOriginal<typeof import('node:path')>()
  const basename = vi.fn((path: string) => path.split('/').pop())

  return {
    ...original,
    default: { ...original, basename },
    basename,
  }
})

// Mock internal utils
vi.mock('../../../src/internal/utils', () => ({
  author: 'Test Author',
  email: 'test@example.com',
  getGitUrl: vi.fn(() => 'https://github.com/test/repo.git'),
}))

describe('内部插件 questions', () => {
  let mockContext: Mocked<CreatePluginContext>
  let describeCallback: DescribeConfig
  let addQuestionsCallbacks: Array<
    () => QuestionConfig[] | SelectQuestionConfig[]
  >
  let mockPath: MockPath
  let mockInternalUtils: MockInternalUtils

  beforeEach(() => {
    addQuestionsCallbacks = []
    mockPath = mockedPath as unknown as MockPath
    mockInternalUtils = mockedInternalUtils as unknown as MockInternalUtils

    mockContext = {
      describe: vi.fn((config: DescribeConfig) => {
        describeCallback = config
      }),
      addQuestions: vi.fn(
        (callback: () => QuestionConfig[] | SelectQuestionConfig[]) => {
          addQuestionsCallbacks.push(callback)
        },
      ),
      config: {
        defaultQuestions: true,
      },
      appData: {
        projectName: 'my-project',
      },
      paths: {
        target: '/path/to/my-project',
      },
    } as unknown as Mocked<CreatePluginContext>
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('应该是一个异步函数', () => {
    expect(typeof questionsPlugin).toBe('function')
  })

  it('应该调用 describe 注册插件配置', async () => {
    await questionsPlugin(mockContext)

    expect(mockContext.describe).toHaveBeenCalledTimes(1)
    expect(mockContext.describe).toHaveBeenCalledWith({
      key: 'defaultQuestions',
      enable: expect.any(Function),
    })
  })

  it('应该调用 addQuestions 两次', async () => {
    await questionsPlugin(mockContext)

    expect(mockContext.addQuestions).toHaveBeenCalledTimes(2)
  })

  describe('启用条件', () => {
    it('当 defaultQuestions 配置为 true 时应该启用', async () => {
      mockContext.config.defaultQuestions = true
      await questionsPlugin(mockContext)

      const result = describeCallback.enable()
      expect(result).toBe(true)
    })

    it('当 defaultQuestions 配置为 false 时应该禁用', async () => {
      mockContext.config.defaultQuestions = false
      await questionsPlugin(mockContext)

      const result = describeCallback.enable()
      expect(result).toBe(false)
    })

    it('当 defaultQuestions 配置为 undefined 时应该禁用', async () => {
      mockContext.config.defaultQuestions = undefined as unknown as boolean
      await questionsPlugin(mockContext)

      const result = describeCallback.enable()
      expect(result).toBe(false)
    })
  })

  describe('第一个 addQuestions 回调（项目信息）', () => {
    it('应该使用负无穷 stage 注册', async () => {
      await questionsPlugin(mockContext)

      expect(mockContext.addQuestions).toHaveBeenNthCalledWith(
        1,
        expect.any(Function),
        {
          stage: Number.NEGATIVE_INFINITY,
        },
      )
    })

    it('应该返回项目信息问题', async () => {
      mockPath.basename.mockReturnValue('my-project')

      await questionsPlugin(mockContext)

      const questions = addQuestionsCallbacks[0]() as QuestionConfig[]

      expect(questions).toHaveLength(5)

      // 名称问题
      expect(questions[0]).toEqual({
        name: 'name',
        type: 'text',
        message: '项目名称',
        initial: 'my-project',
      })

      // 描述问题
      expect(questions[1]).toEqual({
        name: 'description',
        type: 'text',
        message: '项目介绍',
      })

      // 作者问题
      expect(questions[2]).toEqual({
        name: 'author',
        type: 'text',
        message: 'Git 用户名',
        initial: 'Test Author',
      })

      // 邮箱问题
      expect(questions[3]).toEqual({
        name: 'email',
        type: 'text',
        message: 'Git 邮箱',
        initial: 'test@example.com',
      })

      // Git URL 问题
      expect(questions[4]).toEqual({
        name: 'gitUrl',
        type: 'text',
        message: 'Git 地址',
        initial: 'https://github.com/test/repo.git',
      })
    })

    it('当 projectName 不可用时应该使用 path basename', async () => {
      mockPath.basename.mockReturnValue('fallback-project')

      mockContext.appData.projectName = undefined as unknown as string
      await questionsPlugin(mockContext)

      const questions = addQuestionsCallbacks[0]() as QuestionConfig[]

      expect(mockPath.basename).toHaveBeenCalledWith('/path/to/my-project')
      expect(questions[0].initial).toBe('fallback-project')
    })

    it('应该使用目标路径调用 getGitUrl', async () => {
      await questionsPlugin(mockContext)
      const questions = addQuestionsCallbacks[0]() as QuestionConfig[]

      expect(mockInternalUtils.getGitUrl).toHaveBeenCalledWith(
        '/path/to/my-project',
      )
      expect(questions[4].initial).toBe('https://github.com/test/repo.git')
    })
  })

  describe('第二个 addQuestions 回调（包管理器）', () => {
    it('应该使用正无穷 stage 注册', async () => {
      await questionsPlugin(mockContext)

      expect(mockContext.addQuestions).toHaveBeenNthCalledWith(
        2,
        expect.any(Function),
        {
          stage: Number.POSITIVE_INFINITY,
        },
      )
    })

    it('应该返回包管理器问题', async () => {
      await questionsPlugin(mockContext)

      const questions = addQuestionsCallbacks[1]() as SelectQuestionConfig[]

      expect(questions).toHaveLength(1)
      expect(questions[0]).toEqual({
        type: 'select',
        name: 'packageManager',
        message: '包管理器',
        choices: [
          { title: 'npm', value: 'npm' },
          { title: 'yarn', value: 'yarn' },
          { title: 'pnpm', value: 'pnpm' },
        ],
        initial: 2,
      })
    })

    it('应该将 pnpm 作为默认选择（索引 2）', async () => {
      await questionsPlugin(mockContext)

      const questions = addQuestionsCallbacks[1]() as SelectQuestionConfig[]

      expect(questions[0].initial).toBe(2) // pnpm 在索引 2
      expect(questions[0].choices[2].value).toBe('pnpm')
    })
  })

  it('处理问题时不应该抛出异常', async () => {
    await expect(questionsPlugin(mockContext)).resolves.not.toThrow()
  })

  it('应该优雅地处理缺失的 appData', async () => {
    ;(mockContext as { appData: CreatePluginContext['appData'] }).appData =
      {} as Required<CreatePluginContext['appData']>

    await expect(questionsPlugin(mockContext)).resolves.not.toThrow()

    const questions = addQuestionsCallbacks[0]() as QuestionConfig[]
    expect(questions[0].initial).toBe('fallback-project') // 应该回退到 basename
  })
})
