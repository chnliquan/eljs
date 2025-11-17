import appDataPlugin from '../../../src/internal/plugins/app-data'
import type { Api, AppData } from '../../../src/types'

describe('内部插件 app-data', () => {
  let mockApi: jest.Mocked<Api>
  let modifyAppDataCallback: (memo: AppData) => AppData

  beforeEach(() => {
    mockApi = {
      modifyAppData: jest.fn(callback => {
        modifyAppDataCallback = callback
      }),
      prompts: {
        packageManager: 'pnpm' as AppData['packageManager'],
      },
    } as unknown as jest.Mocked<Api>
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('应该是一个函数', () => {
    expect(typeof appDataPlugin).toBe('function')
  })

  it('应该调用 modifyAppData 注册应用数据修改', () => {
    appDataPlugin(mockApi)

    expect(mockApi.modifyAppData).toHaveBeenCalledTimes(1)
    expect(mockApi.modifyAppData).toHaveBeenCalledWith(expect.any(Function))
  })

  it('应该在应用数据中设置来自 prompts 的 packageManager', () => {
    appDataPlugin(mockApi)

    const memo: AppData = {} as AppData
    const result = modifyAppDataCallback(memo)

    expect(result.packageManager).toBe('pnpm')
    expect(result).toBe(memo) // 应该修改并返回同一个对象
  })

  it('应该处理来自 prompts 的不同包管理器', () => {
    const testCases: Array<AppData['packageManager']> = ['npm', 'yarn', 'pnpm']

    testCases.forEach(packageManager => {
      mockApi.prompts.packageManager = packageManager
      appDataPlugin(mockApi)

      const memo: AppData = {} as AppData
      const result = modifyAppDataCallback(memo)

      expect(result.packageManager).toBe(packageManager)
    })
  })

  it('应该保留 memo 中的现有属性', () => {
    appDataPlugin(mockApi)

    const memo = {
      projectName: 'test-project',
      pkg: { name: 'test', version: '1.0.0' },
      paths: { target: '/test' },
      packageManager: 'npm',
      scene: 'web',
      cliVersion: '1.0.0',
    } as AppData

    const result = modifyAppDataCallback(memo)

    expect(result.projectName).toBe('test-project')
    expect(result.pkg).toEqual({ name: 'test', version: '1.0.0' })
    expect(result.paths).toEqual({ target: '/test' })
    expect(result.packageManager).toBe('pnpm')
  })

  it('当 api 没有 prompts 时不应该抛出异常', () => {
    const apiWithoutPrompts = {
      ...mockApi,
      prompts: undefined,
    } as unknown as jest.Mocked<Api>

    expect(() => appDataPlugin(apiWithoutPrompts)).not.toThrow()
  })
})
