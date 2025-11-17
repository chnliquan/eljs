import register from '../../src/internal/register'
import type { Api } from '../../src/types'

describe('内部注册', () => {
  let mockApi: jest.Mocked<Api>

  beforeEach(() => {
    mockApi = {
      registerMethod: jest.fn(),
    } as unknown as jest.Mocked<Api>
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('应该是一个函数', () => {
    expect(typeof register).toBe('function')
  })

  it('应该注册所有必需的方法', () => {
    register(mockApi)

    const expectedMethods = [
      'modifyPaths',
      'modifyAppData',
      'addQuestions',
      'modifyPrompts',
      'modifyTsConfig',
      'modifyJestConfig',
      'modifyPrettierConfig',
      'onBeforeGenerateFiles',
      'onStart',
      'onGenerateFiles',
      'onGenerateDone',
    ]

    expect(mockApi.registerMethod).toHaveBeenCalledTimes(expectedMethods.length)

    expectedMethods.forEach(methodName => {
      expect(mockApi.registerMethod).toHaveBeenCalledWith(methodName)
    })
  })

  it('应该按正确顺序注册方法', () => {
    register(mockApi)

    const calls = mockApi.registerMethod.mock.calls
    expect(calls[0][0]).toBe('modifyPaths')
    expect(calls[1][0]).toBe('modifyAppData')
    expect(calls[2][0]).toBe('addQuestions')
    expect(calls[3][0]).toBe('modifyPrompts')
    expect(calls[4][0]).toBe('modifyTsConfig')
    expect(calls[5][0]).toBe('modifyJestConfig')
    expect(calls[6][0]).toBe('modifyPrettierConfig')
    expect(calls[7][0]).toBe('onBeforeGenerateFiles')
    expect(calls[8][0]).toBe('onStart')
    expect(calls[9][0]).toBe('onGenerateFiles')
    expect(calls[10][0]).toBe('onGenerateDone')
  })

  it('提供 api 时不应该抛出异常', () => {
    expect(() => register(mockApi)).not.toThrow()
  })
})
