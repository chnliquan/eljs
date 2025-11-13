/* eslint-disable @typescript-eslint/no-var-requires */
import { addHook } from 'pirates'

import {
  Transformer,
  type TransformerOptions,
} from '../../src/file/transformer'

// Mock 依赖项
jest.mock('pirates')

describe('文件转换器工具', () => {
  const mockAddHook = addHook as jest.MockedFunction<typeof addHook>

  // 定义测试用的转换函数类型
  interface MockTransformOptions {
    sourcefile?: string
    loader?: string
    target?: string
    format?: string
    logLevel?: string
    customOption?: string
  }

  type MockTransformFunction = (
    input: string,
    options: MockTransformOptions,
  ) => { code: string }

  let mockRevertFunction: jest.MockedFunction<() => void>
  let mockTransformFunction: jest.MockedFunction<MockTransformFunction>
  let transformer: Transformer<MockTransformFunction>

  beforeEach(() => {
    jest.clearAllMocks()

    // 创建 mock 函数
    mockRevertFunction = jest.fn()
    mockTransformFunction = jest
      .fn()
      .mockReturnValue({ code: 'transformed code' })

    // Mock pirates.addHook
    mockAddHook.mockReturnValue(mockRevertFunction)

    // 创建 transformer 实例
    const options: TransformerOptions<MockTransformFunction> = {
      transform: mockTransformFunction,
    }
    transformer = new Transformer(options)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Transformer 构造函数', () => {
    it('应该正确初始化转换器选项', () => {
      const customOptions: TransformerOptions<MockTransformFunction> = {
        transform: mockTransformFunction,
        exts: ['.ts', '.tsx'],
        ignoreNodeModules: false,
      }

      const customTransformer = new Transformer(customOptions)

      expect(customTransformer.constructorOptions).toEqual(customOptions)
      expect(customTransformer.constructorOptions.transform).toBe(
        mockTransformFunction,
      )
      expect(customTransformer.constructorOptions.exts).toEqual(['.ts', '.tsx'])
      expect(customTransformer.constructorOptions.ignoreNodeModules).toBe(false)
    })

    it('应该使用默认选项', () => {
      const basicOptions: TransformerOptions<MockTransformFunction> = {
        transform: mockTransformFunction,
      }

      const basicTransformer = new Transformer(basicOptions)

      expect(basicTransformer.constructorOptions.transform).toBe(
        mockTransformFunction,
      )
      expect(basicTransformer.constructorOptions.exts).toBeUndefined()
      expect(
        basicTransformer.constructorOptions.ignoreNodeModules,
      ).toBeUndefined()
    })
  })

  describe('apply 方法', () => {
    it('应该使用默认扩展名应用转换器', () => {
      transformer.apply()

      expect(mockAddHook).toHaveBeenCalledWith(expect.any(Function), {
        exts: ['.ts'],
        ignoreNodeModules: undefined,
      })
    })

    it('应该使用自定义扩展名应用转换器', () => {
      const customOptions: TransformerOptions<MockTransformFunction> = {
        transform: mockTransformFunction,
        exts: ['.ts', '.tsx', '.jsx'],
        ignoreNodeModules: true,
      }
      const customTransformer = new Transformer(customOptions)

      customTransformer.apply()

      expect(mockAddHook).toHaveBeenCalledWith(expect.any(Function), {
        exts: ['.ts', '.tsx', '.jsx'],
        ignoreNodeModules: true,
      })
    })

    it('应该传递转换选项', () => {
      const transformOptions: MockTransformOptions = {
        customOption: 'test-value',
        target: 'es2020',
      }

      transformer.apply(transformOptions)

      expect(mockAddHook).toHaveBeenCalled()

      // 获取传给 addHook 的转换函数
      const transformerFunction = mockAddHook.mock.calls[0][0]

      // 模拟调用转换函数
      transformerFunction('const test = 1', '/test/file.ts')

      expect(mockTransformFunction).toHaveBeenCalledWith('const test = 1', {
        sourcefile: '/test/file.ts',
        loader: 'ts',
        target: 'es2020', // 自定义选项覆盖默认值
        format: 'cjs',
        logLevel: 'error',
        customOption: 'test-value', // 自定义选项
      })
    })

    it('应该在没有选项时使用默认转换选项', () => {
      transformer.apply()

      const transformerFunction = mockAddHook.mock.calls[0][0]
      transformerFunction('const test = 1', '/test/file.ts')

      expect(mockTransformFunction).toHaveBeenCalledWith('const test = 1', {
        sourcefile: '/test/file.ts',
        loader: 'ts',
        target: 'es2019',
        format: 'cjs',
        logLevel: 'error',
      })
    })
  })

  describe('revert 方法', () => {
    it('应该调用 pirates 返回的恢复函数', () => {
      transformer.apply()
      transformer.revert()

      expect(mockRevertFunction).toHaveBeenCalled()
    })

    it('应该在未应用时安全调用 revert', () => {
      // 创建新的 transformer，但不应用
      const newTransformer = new Transformer({
        transform: mockTransformFunction,
      })

      // 应该不会抛出错误
      expect(() => newTransformer.revert()).not.toThrow()
    })
  })

  describe('_transform 私有方法测试（通过 apply 间接测试）', () => {
    it('应该正确提取文件扩展名', () => {
      transformer.apply()
      const transformerFunction = mockAddHook.mock.calls[0][0]

      const testCases = [
        { filename: '/test/file.ts', expectedLoader: 'ts' },
        { filename: '/test/file.js', expectedLoader: 'js' },
        { filename: '/test/file.tsx', expectedLoader: 'tsx' },
        { filename: '/test/file.mjs', expectedLoader: 'mjs' },
        { filename: '/test/file', expectedLoader: '' },
      ]

      testCases.forEach(testCase => {
        mockTransformFunction.mockClear()
        transformerFunction('code', testCase.filename)

        expect(mockTransformFunction).toHaveBeenCalledWith('code', {
          sourcefile: testCase.filename,
          loader: testCase.expectedLoader,
          target: 'es2019',
          format: 'cjs',
          logLevel: 'error',
        })
      })
    })

    it('应该返回转换后的代码', () => {
      mockTransformFunction.mockReturnValue({ code: 'transformed result' })

      transformer.apply()
      const transformerFunction = mockAddHook.mock.calls[0][0]

      const result = transformerFunction('original code', '/test.ts')

      expect(result).toBe('transformed result')
    })

    it('应该在转换失败时抛出增强的错误', () => {
      mockTransformFunction.mockImplementation(() => {
        throw new Error('Transform error')
      })

      transformer.apply()
      const transformerFunction = mockAddHook.mock.calls[0][0]

      expect(() => transformerFunction('code', '/test/file.ts')).toThrow(
        /Transform .*file\.ts.* failed.*Transform error/,
      )
    })

    it('应该合并默认选项和自定义选项', () => {
      const customOptions: MockTransformOptions = {
        target: 'es2020',
        customOption: 'custom-value',
      }

      transformer.apply(customOptions)
      const transformerFunction = mockAddHook.mock.calls[0][0]
      transformerFunction('code', '/custom.ts')

      expect(mockTransformFunction).toHaveBeenCalledWith('code', {
        sourcefile: '/custom.ts',
        loader: 'ts',
        target: 'es2020', // 自定义选项覆盖默认值
        format: 'cjs',
        logLevel: 'error',
        customOption: 'custom-value', // 自定义选项被添加
      })
    })
  })

  describe('完整的工作流测试', () => {
    it('应该支持完整的应用-转换-恢复周期', () => {
      // 应用转换器
      transformer.apply({ customOption: 'workflow-test' })

      expect(mockAddHook).toHaveBeenCalled()

      // 模拟文件转换
      const transformerFunction = mockAddHook.mock.calls[0][0]
      const result = transformerFunction('const x = 1', '/workflow/test.ts')

      expect(result).toBe('transformed code')
      expect(mockTransformFunction).toHaveBeenCalledWith('const x = 1', {
        sourcefile: '/workflow/test.ts',
        loader: 'ts',
        target: 'es2019',
        format: 'cjs',
        logLevel: 'error',
        customOption: 'workflow-test',
      })

      // 恢复转换器
      transformer.revert()

      expect(mockRevertFunction).toHaveBeenCalled()
    })

    it('应该支持多次应用和恢复', () => {
      // 第一次应用
      transformer.apply()
      expect(mockAddHook).toHaveBeenCalledTimes(1)

      transformer.revert()
      expect(mockRevertFunction).toHaveBeenCalledTimes(1)

      // 第二次应用
      mockAddHook.mockReturnValue(jest.fn()) // 新的 revert 函数
      transformer.apply({ target: 'es2021' })
      expect(mockAddHook).toHaveBeenCalledTimes(2)

      transformer.revert()
      expect(mockRevertFunction).toHaveBeenCalledTimes(1) // 第一个 revert
    })
  })

  describe('类型安全和泛型测试', () => {
    it('应该保持转换函数的类型安全', () => {
      interface SpecificTransformOptions {
        target: 'es2020' | 'es2021'
        minify?: boolean
        sourcemap?: boolean
      }

      type SpecificTransformFunction = (
        input: string,
        options: SpecificTransformOptions,
      ) => { code: string; map?: string }

      const specificTransform: SpecificTransformFunction = jest
        .fn()
        .mockReturnValue({
          code: 'specific code',
          map: 'source map',
        })

      const specificOptions: TransformerOptions<SpecificTransformFunction> = {
        transform: specificTransform,
        exts: ['.ts', '.tsx'],
      }

      const specificTransformer = new Transformer(specificOptions)

      expect(specificTransformer.constructorOptions.transform).toBe(
        specificTransform,
      )
      expect(typeof specificTransformer.apply).toBe('function')
      expect(typeof specificTransformer.revert).toBe('function')
    })

    it('应该处理复杂的转换器配置', () => {
      interface ComplexOptions {
        environment: 'development' | 'production'
        features: string[]
        optimization: {
          level: number
          enabled: boolean
        }
      }

      type ComplexTransformFunction = (
        input: string,
        options: ComplexOptions,
      ) => { code: string }

      const complexTransform: ComplexTransformFunction = jest
        .fn()
        .mockReturnValue({ code: 'complex result' })

      const complexTransformerOptions: TransformerOptions<ComplexTransformFunction> =
        {
          transform: complexTransform,
          exts: ['.ts', '.js', '.tsx', '.jsx'],
          ignoreNodeModules: false,
        }

      const complexTransformer = new Transformer(complexTransformerOptions)

      expect(complexTransformer.constructorOptions).toEqual(
        complexTransformerOptions,
      )
    })
  })

  describe('边界情况和错误处理', () => {
    it('应该处理空的输入代码', () => {
      transformer.apply()
      const transformerFunction = mockAddHook.mock.calls[0][0]

      transformerFunction('', '/empty.ts')

      expect(mockTransformFunction).toHaveBeenCalledWith('', {
        sourcefile: '/empty.ts',
        loader: 'ts',
        target: 'es2019',
        format: 'cjs',
        logLevel: 'error',
      })
    })

    it('应该处理没有扩展名的文件', () => {
      transformer.apply()
      const transformerFunction = mockAddHook.mock.calls[0][0]

      transformerFunction('code', '/no-extension')

      expect(mockTransformFunction).toHaveBeenCalledWith('code', {
        sourcefile: '/no-extension',
        loader: '',
        target: 'es2019',
        format: 'cjs',
        logLevel: 'error',
      })
    })

    it('应该处理复杂的文件路径', () => {
      transformer.apply()
      const transformerFunction = mockAddHook.mock.calls[0][0]

      const complexPath =
        '/very/deep/nested-path.with-special_chars/file.name.ts'
      transformerFunction('code', complexPath)

      expect(mockTransformFunction).toHaveBeenCalledWith('code', {
        sourcefile: complexPath,
        loader: 'ts',
        target: 'es2019',
        format: 'cjs',
        logLevel: 'error',
      })
    })

    it('应该在转换器函数抛出错误时提供详细错误信息', () => {
      mockTransformFunction.mockImplementation(() => {
        throw new Error('Transformation failed with detailed message')
      })

      transformer.apply()
      const transformerFunction = mockAddHook.mock.calls[0][0]

      expect(() => transformerFunction('code', '/error/file.ts')).toThrow(
        /Transform .*\/error\/file\.ts.* failed.*Transformation failed with detailed message/,
      )
    })

    it('应该处理转换器返回的不同代码格式', () => {
      const testCases = [
        { returnValue: { code: 'simple code' }, expected: 'simple code' },
        {
          returnValue: { code: 'code with\nnewlines' },
          expected: 'code with\nnewlines',
        },
        { returnValue: { code: '' }, expected: '' },
        {
          returnValue: { code: 'code with "quotes" and \'apostrophes\'' },
          expected: 'code with "quotes" and \'apostrophes\'',
        },
      ]

      testCases.forEach((testCase, index) => {
        mockTransformFunction.mockReturnValueOnce(testCase.returnValue)

        transformer.apply()
        const transformerFunction = mockAddHook.mock.calls[index][0]

        const result = transformerFunction('input', `/test${index}.ts`)
        expect(result).toBe(testCase.expected)
      })
    })
  })

  describe('与 pirates 库的集成', () => {
    it('应该正确配置 pirates hook', () => {
      const options: TransformerOptions<MockTransformFunction> = {
        transform: mockTransformFunction,
        exts: ['.custom', '.ext'],
        ignoreNodeModules: true,
      }
      const customTransformer = new Transformer(options)

      customTransformer.apply()

      expect(mockAddHook).toHaveBeenCalledWith(expect.any(Function), {
        exts: ['.custom', '.ext'],
        ignoreNodeModules: true,
      })
    })

    it('应该处理 pirates 返回的恢复函数', () => {
      const customRevert = jest.fn()
      mockAddHook.mockReturnValue(customRevert)

      transformer.apply()
      transformer.revert()

      expect(customRevert).toHaveBeenCalled()
    })

    it('应该确保每次 apply 都创建新的 hook', () => {
      const firstRevert = jest.fn()
      const secondRevert = jest.fn()

      mockAddHook
        .mockReturnValueOnce(firstRevert)
        .mockReturnValueOnce(secondRevert)

      // 第一次应用
      transformer.apply()
      expect(mockAddHook).toHaveBeenCalledTimes(1)

      // 第二次应用
      transformer.apply()
      expect(mockAddHook).toHaveBeenCalledTimes(2)

      // 恢复应该调用最后一次的 revert 函数
      transformer.revert()
      expect(secondRevert).toHaveBeenCalled()
      expect(firstRevert).not.toHaveBeenCalled()
    })
  })

  describe('实际转换场景模拟', () => {
    it('应该模拟 TypeScript 到 JavaScript 转换', () => {
      const typescriptTransform = jest.fn().mockReturnValue({
        code: 'var message = "Hello, World!";',
      })

      const tsTransformer = new Transformer({
        transform: typescriptTransform,
        exts: ['.ts'],
      })

      tsTransformer.apply()
      const transformerFunction = mockAddHook.mock.calls[0][0]

      const result = transformerFunction(
        'const message: string = "Hello, World!"',
        '/src/greeting.ts',
      )

      expect(result).toBe('var message = "Hello, World!";')
      expect(typescriptTransform).toHaveBeenCalledWith(
        'const message: string = "Hello, World!"',
        {
          sourcefile: '/src/greeting.ts',
          loader: 'ts',
          target: 'es2019',
          format: 'cjs',
          logLevel: 'error',
        },
      )
    })

    it('应该模拟 JSX 转换', () => {
      const jsxTransform = jest.fn().mockReturnValue({
        code: 'React.createElement("div", null, "Hello")',
      })

      const jsxTransformer = new Transformer({
        transform: jsxTransform,
        exts: ['.jsx', '.tsx'],
      })

      jsxTransformer.apply()
      const transformerFunction = mockAddHook.mock.calls[0][0]

      transformerFunction('<div>Hello</div>', '/components/Hello.jsx')

      expect(jsxTransform).toHaveBeenCalledWith('<div>Hello</div>', {
        sourcefile: '/components/Hello.jsx',
        loader: 'jsx',
        target: 'es2019',
        format: 'cjs',
        logLevel: 'error',
      })
    })
  })
})
