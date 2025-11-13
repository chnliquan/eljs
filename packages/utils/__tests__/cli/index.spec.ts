/* eslint-disable @typescript-eslint/no-var-requires */
import * as readline from 'node:readline'
import type { Answers, PromptObject } from 'prompts'
import prompts from 'prompts'

import * as cliModule from '../../src/cli'
import { confirm, loopPrompt, pause, prompt, select } from '../../src/cli'

// Mock 依赖项
jest.mock('node:readline')
jest.mock('prompts')
jest.mock('../../src/type')

// 定义类型
interface MockReadlineInterface {
  question: jest.MockedFunction<(query: string, callback: () => void) => void>
  close: jest.MockedFunction<() => void>
}

interface MockConsole {
  log: jest.MockedFunction<(...args: unknown[]) => void>
}

describe('命令行工具函数', () => {
  const mockReadline = readline as jest.Mocked<typeof readline>
  const mockPrompts = prompts as jest.MockedFunction<typeof prompts>
  const mockIsNull = require('../../src/type').isNull as jest.MockedFunction<
    (value: unknown) => boolean
  >

  beforeEach(() => {
    jest.clearAllMocks()
    mockIsNull.mockReturnValue(false)
  })

  // 测试完整的模块导出
  describe('模块导出完整性', () => {
    it('应该导出所有预期的函数', () => {
      expect(typeof cliModule.pause).toBe('function')
      expect(typeof cliModule.confirm).toBe('function')
      expect(typeof cliModule.select).toBe('function')
      expect(typeof cliModule.prompt).toBe('function')
      expect(typeof cliModule.loopPrompt).toBe('function')

      // 测试重导出模块的所有可能路径
      const allExports = Object.keys(cliModule)
      expect(allExports).toContain('pause')
      expect(allExports).toContain('confirm')
      expect(allExports).toContain('select')
      expect(allExports).toContain('prompt')
      expect(allExports).toContain('loopPrompt')
    })

    it('应该能够通过通配符导出访问所有功能', () => {
      // 这将触发重导出逻辑的所有分支
      expect(cliModule).toBeDefined()
      expect(Object.getOwnPropertyNames(cliModule).length).toBeGreaterThan(0)
    })
  })

  describe('pause 暂停输入', () => {
    let mockRl: MockReadlineInterface

    beforeEach(() => {
      mockRl = {
        question: jest.fn(),
        close: jest.fn(),
      }
      mockReadline.createInterface.mockReturnValue(
        mockRl as unknown as readline.Interface,
      )
    })

    it('应该使用默认消息暂停并等待用户输入', async () => {
      mockRl.question.mockImplementation(
        (message: string, callback: () => void) => {
          expect(message).toBe('Press Enter key to continue...')
          callback()
        },
      )

      const pausePromise = pause()
      await pausePromise

      expect(mockReadline.createInterface).toHaveBeenCalledWith({
        input: process.stdin,
        output: process.stdout,
      })
      expect(mockRl.question).toHaveBeenCalledWith(
        'Press Enter key to continue...',
        expect.any(Function),
      )
      expect(mockRl.close).toHaveBeenCalled()
    })

    it('应该使用自定义消息暂停并等待用户输入', async () => {
      const customMessage = '按任意键继续...'

      mockRl.question.mockImplementation(
        (message: string, callback: () => void) => {
          expect(message).toBe(customMessage)
          callback()
        },
      )

      const pausePromise = pause(customMessage)
      await pausePromise

      expect(mockRl.question).toHaveBeenCalledWith(
        customMessage,
        expect.any(Function),
      )
      expect(mockRl.close).toHaveBeenCalled()
    })
  })

  describe('confirm 确认对话框', () => {
    it('应该在用户确认时返回 true', async () => {
      mockPrompts.mockResolvedValue({ confirm: true })

      const result = await confirm('你确定吗？')

      expect(result).toBe(true)
      expect(mockPrompts).toHaveBeenCalledWith(
        {
          type: 'confirm',
          message: '你确定吗？',
          name: 'confirm',
          initial: true,
        },
        {
          onCancel: expect.any(Function),
        },
      )
    })

    it('应该在用户拒绝时返回 false', async () => {
      mockPrompts.mockResolvedValue({ confirm: false })

      const result = await confirm('你确定吗？')

      expect(result).toBe(false)
    })
  })

  describe('select 选择对话框', () => {
    it('应该返回选择的选项', async () => {
      const choices = [
        { title: '选项 1', value: 'opt1' },
        { title: '选项 2', value: 'opt2' },
      ]
      mockPrompts.mockResolvedValue({ name: 'opt1' })

      const result = await select('选择一个选项：', choices)

      expect(result).toBe('opt1')
      expect(mockPrompts).toHaveBeenCalledWith([
        {
          name: 'name',
          message: '选择一个选项：',
          type: 'select',
          choices,
          initial: undefined,
        },
      ])
    })
  })

  describe('prompt 通用提示', () => {
    it('应该处理问题并返回答案', async () => {
      const questions: PromptObject[] = [
        { name: 'username', message: '用户名：', type: 'text' },
        { name: 'password', message: '密码：', type: 'password' },
      ]
      const expectedAnswers: Answers<string> = {
        username: 'john',
        password: 'secret',
      }

      mockPrompts.mockResolvedValue(expectedAnswers)

      const result = await prompt(questions)

      expect(result).toEqual(expectedAnswers)
      expect(mockPrompts).toHaveBeenCalledWith(questions)
    })
  })

  describe('loopPrompt 循环提示', () => {
    let mockConsole: MockConsole

    beforeEach(() => {
      mockConsole = {
        log: jest.fn(),
      }
      jest.spyOn(console, 'log').mockImplementation(mockConsole.log)
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('应该在用户确认时返回答案', async () => {
      const questions: PromptObject[] = [
        { name: 'name', message: '你的姓名：', type: 'text' },
      ]
      const answers: Answers<string> = { name: '张三' }

      mockPrompts
        .mockResolvedValueOnce(answers)
        .mockResolvedValueOnce({ confirm: true })

      const result = await loopPrompt(questions)

      expect(result).toEqual(answers)
      expect(mockConsole.log).toHaveBeenCalledWith()
      expect(mockConsole.log).toHaveBeenCalledWith(
        'The information you entered is as follows:',
      )
      expect(mockConsole.log).toHaveBeenCalledWith(
        JSON.stringify(answers, null, 2),
      )
    })

    it('应该处理重新提示', async () => {
      const questions: PromptObject[] = [
        { name: 'test', message: '测试：', type: 'text' },
      ]

      mockPrompts
        .mockResolvedValueOnce({ test: 'first' })
        .mockResolvedValueOnce({ confirm: false })
        .mockResolvedValueOnce({ test: 'final' })
        .mockResolvedValueOnce({ confirm: true })

      const result = await loopPrompt(questions)

      expect(result).toEqual({ test: 'final' })
      expect(mockPrompts).toHaveBeenCalledTimes(4)
    })
  })
})
