import {
  camelCase,
  kebabCase,
  pascalCase,
  stripBlankLines,
} from '../../src/string'

describe('字符串工具函数', () => {
  describe('camelCase 小驼峰转换', () => {
    it('应该将 kebab-case 转换为 camelCase', () => {
      expect(camelCase('hello-world')).toBe('helloWorld')
      expect(camelCase('test-case-string')).toBe('testCaseString')
      expect(camelCase('single')).toBe('single')
    })

    it('应该将 snake_case 转换为 camelCase', () => {
      expect(camelCase('hello_world')).toBe('helloWorld')
      expect(camelCase('test_case_string')).toBe('testCaseString')
      expect(camelCase('snake_case')).toBe('snakeCase')
    })

    it('应该将空格分隔转换为 camelCase', () => {
      expect(camelCase('hello world')).toBe('helloWorld')
      expect(camelCase('test case string')).toBe('testCaseString')
      expect(camelCase('space separated')).toBe('spaceSeparated')
    })

    it('应该处理混合分隔符', () => {
      expect(camelCase('hello-world_test case')).toBe('helloWorldTestCase')
      expect(camelCase('mixed_case-string test')).toBe('mixedCaseStringTest')
    })

    it('应该处理边界情况', () => {
      expect(camelCase('')).toBe('')
      expect(camelCase('a')).toBe('a')
      expect(camelCase('-')).toBe('')
      expect(camelCase('_')).toBe('')
      expect(camelCase(' ')).toBe('')
      expect(camelCase('--')).toBe('')
      expect(camelCase('__')).toBe('')
      expect(camelCase('  ')).toBe('')
    })

    it('应该保持已有的 camelCase 格式', () => {
      expect(camelCase('alreadyCamelCase')).toBe('alreadyCamelCase')
      expect(camelCase('someVariableName')).toBe('someVariableName')
    })
  })

  describe('pascalCase 大驼峰转换', () => {
    it('应该将 kebab-case 转换为 PascalCase', () => {
      expect(pascalCase('hello-world')).toBe('HelloWorld')
      expect(pascalCase('test-case-string')).toBe('TestCaseString')
      expect(pascalCase('single')).toBe('Single')
    })

    it('应该将 snake_case 转换为 PascalCase', () => {
      expect(pascalCase('hello_world')).toBe('HelloWorld')
      expect(pascalCase('test_case_string')).toBe('TestCaseString')
      expect(pascalCase('snake_case')).toBe('SnakeCase')
    })

    it('应该将空格分隔转换为 PascalCase', () => {
      expect(pascalCase('hello world')).toBe('HelloWorld')
      expect(pascalCase('test case string')).toBe('TestCaseString')
      expect(pascalCase('space separated')).toBe('SpaceSeparated')
    })

    it('应该处理混合分隔符', () => {
      expect(pascalCase('hello-world_test case')).toBe('HelloWorldTestCase')
      expect(pascalCase('mixed_case-string test')).toBe('MixedCaseStringTest')
    })

    it('应该处理边界情况', () => {
      expect(pascalCase('')).toBe('')
      expect(pascalCase('a')).toBe('A')
      expect(pascalCase('-')).toBe('')
      expect(pascalCase('_')).toBe('')
      expect(pascalCase(' ')).toBe('')
    })

    it('应该将 camelCase 转换为 PascalCase', () => {
      expect(pascalCase('alreadyCamelCase')).toBe('AlreadyCamelCase')
      expect(pascalCase('someVariableName')).toBe('SomeVariableName')
    })
  })

  describe('kebabCase 中划线转换', () => {
    it('应该将 PascalCase 转换为 kebab-case', () => {
      expect(kebabCase('HelloWorld')).toBe('hello-world')
      expect(kebabCase('TestCaseString')).toBe('test-case-string')
      expect(kebabCase('SingleWord')).toBe('single-word')
    })

    it('应该将 camelCase 转换为 kebab-case', () => {
      expect(kebabCase('helloWorld')).toBe('hello-world')
      expect(kebabCase('testCaseString')).toBe('test-case-string')
      expect(kebabCase('someVariableName')).toBe('some-variable-name')
    })

    it('应该将 snake_case 转换为 kebab-case', () => {
      expect(kebabCase('hello_world')).toBe('hello-world')
      expect(kebabCase('test_case_string')).toBe('test-case-string')
      expect(kebabCase('snake_case')).toBe('snake-case')
    })

    it('应该将空格分隔转换为 kebab-case', () => {
      expect(kebabCase('hello world')).toBe('hello-world')
      expect(kebabCase('test case string')).toBe('test-case-string')
      expect(kebabCase('space separated')).toBe('space-separated')
    })

    it('应该处理混合情况', () => {
      expect(kebabCase('HelloWorld_Test case')).toBe('hello-world-test-case')
      expect(kebabCase('MixedCase-string_test')).toBe('mixed-case-string-test')
    })

    it('应该处理边界情况', () => {
      expect(kebabCase('')).toBe('')
      expect(kebabCase('a')).toBe('a')
      expect(kebabCase('A')).toBe('a')
      expect(kebabCase('single')).toBe('single')
      expect(kebabCase('Single')).toBe('single')
    })

    it('应该保持已有的 kebab-case 格式', () => {
      expect(kebabCase('already-kebab-case')).toBe('already-kebab-case')
      expect(kebabCase('some-variable-name')).toBe('some-variable-name')
    })
  })

  describe('stripBlankLines 去除空白行', () => {
    it('应该从字符串中移除空白行', () => {
      const input = 'line1\n\nline2\n\n\nline3'
      const expected = 'line1\nline2\nline3'
      expect(stripBlankLines(input)).toBe(expected)
    })

    it('应该移除只包含空白字符的行', () => {
      const input = 'line1\n   \nline2\n\t\nline3'
      const expected = 'line1\nline2\nline3'
      expect(stripBlankLines(input)).toBe(expected)
    })

    it('应该处理混合的行结束符', () => {
      const input = 'line1\r\n\r\nline2\n\nline3'
      const expected = 'line1\r\nline2\nline3'
      expect(stripBlankLines(input)).toBe(expected)
    })

    it('应该处理没有空白行的字符串', () => {
      const input = 'line1\nline2\nline3'
      expect(stripBlankLines(input)).toBe(input)
    })

    it('应该处理空字符串和单行', () => {
      expect(stripBlankLines('')).toBe('')
      expect(stripBlankLines('single-line')).toBe('single-line')
      expect(stripBlankLines('\n')).toBe('')
      expect(stripBlankLines('\n\n')).toBe('')
    })

    it('应该处理只包含空白行的字符串', () => {
      expect(stripBlankLines('\n\n\n')).toBe('')
      expect(stripBlankLines('   \n\t\n   \n')).toBe('')
    })

    it('应该保持内容行的正确间距', () => {
      const input =
        'function test() {\n\n  console.log("hello")\n\n  return true\n\n}'
      const expected =
        'function test() {\n  console.log("hello")\n  return true\n}'
      expect(stripBlankLines(input)).toBe(expected)
    })
  })
})
