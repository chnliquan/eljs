import * as os from 'node:os'
import { logger, prefixes } from '../../src/logger'

// Mock 控制台方法
const mockConsole = {
  log: jest.fn() as jest.MockedFunction<typeof console.log>,
  warn: jest.fn() as jest.MockedFunction<typeof console.warn>,
  error: jest.fn() as jest.MockedFunction<typeof console.error>,
}

// Mock process.exit
const mockExit = jest.fn<never, [code?: number]>()

describe('日志工具函数', () => {
  beforeEach(() => {
    mockConsole.log.mockClear()
    mockConsole.warn.mockClear()
    mockConsole.error.mockClear()
    mockExit.mockClear()

    // Mock 控制台方法
    jest.spyOn(console, 'log').mockImplementation(mockConsole.log)
    jest.spyOn(console, 'warn').mockImplementation(mockConsole.warn)
    jest.spyOn(console, 'error').mockImplementation(mockConsole.error)

    // Mock process.exit
    jest.spyOn(process, 'exit').mockImplementation(mockExit)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('prefixes 前缀', () => {
    it('应该导出所有预期的前缀', () => {
      expect(prefixes).toHaveProperty('event')
      expect(prefixes).toHaveProperty('info')
      expect(prefixes).toHaveProperty('warn')
      expect(prefixes).toHaveProperty('error')
      expect(prefixes).toHaveProperty('fatal')
      expect(prefixes).toHaveProperty('wait')
      expect(prefixes).toHaveProperty('ready')
    })

    it('应该有带连字符的彩色前缀', () => {
      // 检查前缀包含颜色代码并以 ' -' 结尾
      Object.values(prefixes).forEach((prefix: string) => {
        expect(prefix).toContain(' -')
        expect(prefix.length).toBeGreaterThan(6) // 应该包含 ANSI 代码
      })
    })
  })

  describe('Logger 类', () => {
    describe('format 格式化', () => {
      it('应该格式化单行消息', () => {
        const result = logger.format('标签:', '单行消息')
        expect(result).toBe('标签: 单行消息')
      })

      it('应该格式化多行消息', () => {
        const message = `第一行${os.EOL}第二行${os.EOL}第三行`
        const result = logger.format('标签:', message)

        const lines = result.split(os.EOL)
        expect(lines[0]).toBe('标签: 第一行')
        expect(lines[1]).toMatch(/^\s+第二行$/)
        expect(lines[2]).toMatch(/^\s+第三行$/)
      })

      it('应该正确对齐延续行', () => {
        const message = `行1${os.EOL}行2`
        const result = logger.format('测试', message)

        const lines = result.split(os.EOL)
        expect(lines[0]).toBe('测试 行1')
        expect(lines[1]).toMatch(/^\s+行2$/)
        // 检查缩进匹配标签长度
        expect(lines[1].indexOf('行2')).toBe('测试 '.length)
      })
    })

    describe('log 日志', () => {
      it('应该记录不带标签的纯消息', () => {
        logger.log('测试消息')

        expect(mockConsole.log).toHaveBeenCalledWith('测试消息')
      })

      it('应该记录带自定义标签的消息', () => {
        logger.log('测试消息', '自定义')

        expect(mockConsole.log).toHaveBeenCalledTimes(1)
        const calledWith = mockConsole.log.mock.calls[0][0]
        expect(calledWith).toContain('测试消息')
        expect(calledWith).toContain('自定义')
      })
    })

    describe('event 事件日志', () => {
      it('应该记录事件消息', () => {
        logger.event('测试事件')

        expect(mockConsole.log).toHaveBeenCalledTimes(1)
        const calledWith = mockConsole.log.mock.calls[0][0]
        expect(calledWith).toContain('测试事件')
      })
    })

    describe('info 信息日志', () => {
      it('应该记录信息消息', () => {
        logger.info('测试信息')

        expect(mockConsole.log).toHaveBeenCalledTimes(1)
        const calledWith = mockConsole.log.mock.calls[0][0]
        expect(calledWith).toContain('测试信息')
      })
    })

    describe('warn 警告日志', () => {
      it('应该记录警告消息', () => {
        logger.warn('测试警告')

        expect(mockConsole.warn).toHaveBeenCalledTimes(1)
        const calledWith = mockConsole.warn.mock.calls[0][0]
        expect(calledWith).toContain('测试警告')
      })
    })

    describe('error 错误日志', () => {
      it('应该记录错误消息', () => {
        logger.error('测试错误')

        expect(mockConsole.error).toHaveBeenCalledTimes(1)
        const calledWith = mockConsole.error.mock.calls[0][0]
        expect(calledWith).toContain('测试错误')
      })
    })

    describe('fatal 致命错误日志', () => {
      it('应该记录致命错误消息', () => {
        logger.fatal('测试致命错误')

        expect(mockConsole.error).toHaveBeenCalledTimes(1)
        const calledWith = mockConsole.error.mock.calls[0][0]
        expect(calledWith).toContain('测试致命错误')
      })
    })

    describe('wait 等待日志', () => {
      it('应该记录等待消息', () => {
        logger.wait('测试等待')

        expect(mockConsole.log).toHaveBeenCalledTimes(1)
        const calledWith = mockConsole.log.mock.calls[0][0]
        expect(calledWith).toContain('测试等待')
      })
    })

    describe('ready 就绪日志', () => {
      it('应该记录就绪消息', () => {
        logger.ready('测试就绪')

        expect(mockConsole.log).toHaveBeenCalledTimes(1)
        const calledWith = mockConsole.log.mock.calls[0][0]
        expect(calledWith).toContain('测试就绪')
      })
    })

    describe('printErrorAndExit 打印错误并退出', () => {
      it('应该记录错误并退出进程', () => {
        logger.printErrorAndExit('致命错误')

        expect(mockConsole.error).toHaveBeenCalledTimes(1)
        const calledWith = mockConsole.error.mock.calls[0][0]
        expect(calledWith).toContain('致命错误')
        expect(mockExit).toHaveBeenCalledWith(1)
      })
    })

    describe('step 步骤日志', () => {
      it('应该在提供消息时立即记录步骤消息', () => {
        logger.step('测试步骤', '步骤消息')

        expect(mockConsole.log).toHaveBeenCalledTimes(1)
        const calledWith = mockConsole.log.mock.calls[0][0]
        expect(calledWith).toContain('测试步骤')
        expect(calledWith).toContain('步骤消息')
      })

      it('应该在未提供消息时返回函数', () => {
        const stepFn = logger.step('测试步骤')

        expect(typeof stepFn).toBe('function')
        expect(mockConsole.log).not.toHaveBeenCalled()

        // 调用返回的函数
        stepFn('延期消息')

        expect(mockConsole.log).toHaveBeenCalledTimes(1)
        const calledWith = mockConsole.log.mock.calls[0][0]
        expect(calledWith).toContain('测试步骤')
        expect(calledWith).toContain('延期消息')
      })
    })

    describe('clear 清屏', () => {
      let originalIsTTY: boolean

      beforeEach(() => {
        originalIsTTY = process.stdout.isTTY
      })

      afterEach(() => {
        process.stdout.isTTY = originalIsTTY
      })

      it('应该在非 TTY 时不清屏', () => {
        process.stdout.isTTY = false

        logger.clear()

        expect(mockConsole.log).not.toHaveBeenCalled()
      })

      it('应该在 TTY 时清屏并可选择性显示标题', () => {
        process.stdout.isTTY = true
        // 为 process.stdout 添加 rows 属性以进行测试
        Object.defineProperty(process.stdout, 'rows', {
          value: 24,
          configurable: true,
        })

        logger.clear('测试标题')

        expect(mockConsole.log).toHaveBeenCalledWith('测试标题')
      })

      it('应该在未提供标题时清屏', () => {
        process.stdout.isTTY = true
        // 为 process.stdout 添加 rows 属性以进行测试
        Object.defineProperty(process.stdout, 'rows', {
          value: 24,
          configurable: true,
        })

        logger.clear()

        // 仍应调用 console.log 用于空白行，但不包含标题
        expect(mockConsole.log).toHaveBeenCalled()
      })
    })
  })
})
