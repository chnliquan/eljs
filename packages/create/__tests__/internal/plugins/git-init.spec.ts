import gitInitPlugin from '../../../src/internal/plugins/git-init'
import type { Api } from '../../../src/types'

// Mock types
interface MockUtils {
  hasGit: jest.MockedFunction<() => Promise<boolean>>
  hasProjectGit: jest.MockedFunction<(path: string) => Promise<boolean>>
  logger: {
    info: jest.MockedFunction<(message: string) => void>
  }
  run: jest.MockedFunction<
    (
      command: string,
      args: string[],
      options?: { cwd?: string; verbose?: boolean },
    ) => Promise<void>
  >
}

interface DescribeConfig {
  enable: () => boolean
}

// Mock @eljs/utils
jest.mock('@eljs/utils', () => ({
  hasGit: jest.fn(),
  hasProjectGit: jest.fn(),
  logger: {
    info: jest.fn(),
  },
  run: jest.fn(),
}))

describe('内部插件 git-init', () => {
  let mockApi: jest.Mocked<Api>
  let describeCallback: DescribeConfig
  let onGenerateDoneCallback: () => Promise<void>
  let mockUtils: MockUtils

  beforeEach(() => {
    mockUtils = jest.requireMock('@eljs/utils') as MockUtils

    mockApi = {
      describe: jest.fn((config: DescribeConfig) => {
        describeCallback = config
      }),
      onGenerateDone: jest.fn((callback: () => Promise<void>) => {
        onGenerateDoneCallback = callback
      }),
      config: {
        gitInit: true,
      },
      paths: {
        target: '/test/project',
      },
      prompts: {
        git: true,
      },
    } as unknown as jest.Mocked<Api>
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('应该是一个异步函数', () => {
    expect(typeof gitInitPlugin).toBe('function')
  })

  it('应该调用 describe 注册插件配置', async () => {
    await gitInitPlugin(mockApi)

    expect(mockApi.describe).toHaveBeenCalledTimes(1)
    expect(mockApi.describe).toHaveBeenCalledWith({
      enable: expect.any(Function),
    })
  })

  it('应该调用 onGenerateDone 注册 git 初始化钩子', async () => {
    await gitInitPlugin(mockApi)

    expect(mockApi.onGenerateDone).toHaveBeenCalledTimes(1)
    expect(mockApi.onGenerateDone).toHaveBeenCalledWith(expect.any(Function), {
      stage: Number.NEGATIVE_INFINITY,
    })
  })

  describe('启用条件', () => {
    it('当 gitInit 配置为 true 时应该启用', async () => {
      mockApi.config.gitInit = true
      await gitInitPlugin(mockApi)

      const result = describeCallback.enable()
      expect(result).toBe(true)
    })

    it('当 gitInit 配置为 false 时应该禁用', async () => {
      mockApi.config.gitInit = false
      await gitInitPlugin(mockApi)

      const result = describeCallback.enable()
      expect(result).toBe(false)
    })

    it('当 gitInit 配置为 undefined 时应该禁用', async () => {
      mockApi.config.gitInit = undefined as unknown as boolean
      await gitInitPlugin(mockApi)

      const result = describeCallback.enable()
      expect(result).toBe(false)
    })
  })

  describe('shouldInitGit 逻辑', () => {
    beforeEach(() => {
      mockUtils.hasGit.mockResolvedValue(true)
      mockUtils.hasProjectGit.mockResolvedValue(false)
    })

    it('当所有条件满足时应该初始化 git', async () => {
      await gitInitPlugin(mockApi)

      await onGenerateDoneCallback()

      expect(mockUtils.hasGit).toHaveBeenCalled()
      expect(mockUtils.hasProjectGit).toHaveBeenCalledWith('/test/project')
      expect(mockUtils.logger.info).toHaveBeenCalledWith(
        '🗃  Initializing git repository ...',
      )
      expect(mockUtils.run).toHaveBeenCalledWith('git', ['init'], {
        cwd: '/test/project',
        verbose: false,
      })
    })

    it('当 git 不可用时应该跳过 git 初始化', async () => {
      mockUtils.hasGit.mockResolvedValue(false)

      await gitInitPlugin(mockApi)
      await onGenerateDoneCallback()

      expect(mockUtils.hasGit).toHaveBeenCalled()
      expect(mockUtils.hasProjectGit).not.toHaveBeenCalled()
      expect(mockUtils.logger.info).not.toHaveBeenCalled()
      expect(mockUtils.run).not.toHaveBeenCalled()
    })

    it('当项目已有 git 时应该跳过 git 初始化', async () => {
      mockUtils.hasProjectGit.mockResolvedValue(true)

      await gitInitPlugin(mockApi)
      await onGenerateDoneCallback()

      expect(mockUtils.hasGit).toHaveBeenCalled()
      expect(mockUtils.hasProjectGit).toHaveBeenCalledWith('/test/project')
      expect(mockUtils.logger.info).not.toHaveBeenCalled()
      expect(mockUtils.run).not.toHaveBeenCalled()
    })

    it('当 prompts.git 为 false 时应该跳过 git 初始化', async () => {
      mockApi.prompts.git = false

      await gitInitPlugin(mockApi)
      await onGenerateDoneCallback()

      expect(mockUtils.hasGit).toHaveBeenCalled()
      expect(mockUtils.hasProjectGit).toHaveBeenCalledWith('/test/project')
      expect(mockUtils.logger.info).not.toHaveBeenCalled()
      expect(mockUtils.run).not.toHaveBeenCalled()
    })

    it('当 prompts.git 为 "false" 时应该跳过 git 初始化', async () => {
      mockApi.prompts.git = 'false'

      await gitInitPlugin(mockApi)
      await onGenerateDoneCallback()

      expect(mockUtils.hasGit).toHaveBeenCalled()
      expect(mockUtils.hasProjectGit).toHaveBeenCalledWith('/test/project')
      expect(mockUtils.logger.info).not.toHaveBeenCalled()
      expect(mockUtils.run).not.toHaveBeenCalled()
    })

    it('当 prompts.git 为真值字符串时应该初始化 git', async () => {
      mockApi.prompts.git = 'true'

      await gitInitPlugin(mockApi)
      await onGenerateDoneCallback()

      expect(mockUtils.hasGit).toHaveBeenCalled()
      expect(mockUtils.hasProjectGit).toHaveBeenCalledWith('/test/project')
      expect(mockUtils.logger.info).toHaveBeenCalledWith(
        '🗃  Initializing git repository ...',
      )
      expect(mockUtils.run).toHaveBeenCalledWith('git', ['init'], {
        cwd: '/test/project',
        verbose: false,
      })
    })

    it('应该处理未定义的 prompts.git', async () => {
      mockApi.prompts.git = undefined

      await gitInitPlugin(mockApi)
      await onGenerateDoneCallback()

      expect(mockUtils.hasGit).toHaveBeenCalled()
      expect(mockUtils.hasProjectGit).toHaveBeenCalledWith('/test/project')
      expect(mockUtils.logger.info).toHaveBeenCalledWith(
        '🗃  Initializing git repository ...',
      )
      expect(mockUtils.run).toHaveBeenCalledWith('git', ['init'], {
        cwd: '/test/project',
        verbose: false,
      })
    })
  })

  it('当所有依赖都可用时不应该抛出异常', async () => {
    mockUtils.hasGit.mockResolvedValue(true)
    mockUtils.hasProjectGit.mockResolvedValue(false)

    await expect(gitInitPlugin(mockApi)).resolves.not.toThrow()
    await expect(onGenerateDoneCallback()).resolves.not.toThrow()
  })
})
