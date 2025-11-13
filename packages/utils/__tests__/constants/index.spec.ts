import { PLATFORM } from '../../src/constants'

describe('常量定义', () => {
  describe('PLATFORM 平台常量', () => {
    it('应该导出正确的平台常量', () => {
      expect(PLATFORM.WIN).toBe('win32')
      expect(PLATFORM.LINUX).toBe('linux')
      expect(PLATFORM.MAC).toBe('darwin')
    })

    it('应该具有所有预期的平台属性', () => {
      expect(PLATFORM).toHaveProperty('WIN')
      expect(PLATFORM).toHaveProperty('LINUX')
      expect(PLATFORM).toHaveProperty('MAC')
    })

    it('应该匹配 Node.js 平台值', () => {
      // 这些应该匹配 Node.js 使用的实际平台字符串
      expect(PLATFORM.WIN).toMatch(/^win/)
      expect(PLATFORM.LINUX).toBe('linux')
      expect(PLATFORM.MAC).toBe('darwin')
    })
  })
})
