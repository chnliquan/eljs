import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mocked,
} from 'vitest'
import appDataPlugin from '../../../src/internal/plugins/app-data'
import type { CreatePluginContext } from '../../../src/types'

describe('内部插件 app-data', () => {
  let mockContext: Mocked<CreatePluginContext>
  let onStartCallback: () => void

  beforeEach(() => {
    mockContext = {
      onStart: vi.fn(callback => {
        onStartCallback = callback
      }),
      prompts: {
        packageManager: 'pnpm',
      },
      appData: {
        packageManager: 'pnpm',
      },
    } as unknown as Mocked<CreatePluginContext>
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('应该是一个函数', () => {
    expect(typeof appDataPlugin).toBe('function')
  })

  it('应该在生成开始时同步包管理器', () => {
    appDataPlugin(mockContext)

    expect(mockContext.onStart).toHaveBeenCalledWith(expect.any(Function), {
      stage: Number.NEGATIVE_INFINITY,
    })
  })

  it('应该在应用数据中设置来自 prompts 的 packageManager', () => {
    appDataPlugin(mockContext)
    mockContext.prompts.packageManager = 'yarn'

    onStartCallback()

    expect(mockContext.appData.packageManager).toBe('yarn')
  })

  it('应该处理来自 prompts 的不同包管理器', () => {
    const testCases = ['npm', 'yarn', 'pnpm'] as const

    testCases.forEach(packageManager => {
      mockContext.prompts.packageManager = packageManager
      appDataPlugin(mockContext)

      onStartCallback()

      expect(mockContext.appData.packageManager).toBe(packageManager)
    })
  })

  it('没有选择包管理器时应该保留默认值', () => {
    mockContext.prompts.packageManager = undefined
    mockContext.appData.packageManager = 'pnpm'
    appDataPlugin(mockContext)

    onStartCallback()

    expect(mockContext.appData.packageManager).toBe('pnpm')
  })

  it('插件初始化时不应该提前读取 prompts', () => {
    expect(() => appDataPlugin(mockContext)).not.toThrow()
  })
})
