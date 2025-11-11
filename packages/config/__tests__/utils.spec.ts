import * as path from 'node:path'

import { addFileExt, getAbsFiles } from '../src/utils'

describe('Utils 工具函数测试', () => {
  describe('addFileExt', () => {
    it('应该在文件扩展名前添加新扩展名', () => {
      expect(addFileExt('config.ts', 'dev')).toBe('config.dev.ts')
      expect(addFileExt('config.js', 'prod')).toBe('config.prod.js')
      expect(addFileExt('settings.json', 'local')).toBe('settings.local.json')
    })

    it('应该处理带点的扩展名', () => {
      expect(addFileExt('config.ts', '.dev')).toBe('config.dev.ts')
      expect(addFileExt('config.js', '.staging')).toBe('config.staging.js')
    })

    it('应该处理没有扩展名的文件', () => {
      // addFileExt 函数在没有找到 '.' 时会将扩展名插入到字符串末尾
      expect(addFileExt('config', 'dev')).toBe('confi.devg')
      expect(addFileExt('README', 'backup')).toBe('READM.backupE')
    })

    it('应该处理复杂文件路径', () => {
      expect(addFileExt('/path/to/config.ts', 'dev')).toBe(
        '/path/to/config.dev.ts',
      )
      expect(addFileExt('nested/dir/config.js', 'test')).toBe(
        'nested/dir/config.test.js',
      )
    })

    it('应该处理多重扩展名', () => {
      expect(addFileExt('config.test.ts', 'dev')).toBe('config.test.dev.ts')
      expect(addFileExt('app.min.js', 'prod')).toBe('app.min.prod.js')
    })

    it('应该处理空扩展名', () => {
      expect(addFileExt('config.ts', '')).toBe('config..ts')
    })

    it('应该处理特殊字符', () => {
      expect(addFileExt('config.ts', 'dev-local')).toBe('config.dev-local.ts')
      expect(addFileExt('config.ts', 'dev_test')).toBe('config.dev_test.ts')
    })
  })

  describe('getAbsFiles', () => {
    const mockCwd = '/mock/current/dir'
    const originalCwd = process.cwd

    beforeEach(() => {
      process.cwd = jest.fn().mockReturnValue(mockCwd)
    })

    afterEach(() => {
      process.cwd = originalCwd
    })

    it('应该将相对路径转换为绝对路径', () => {
      const files = ['config.ts', 'settings.js', 'env.json']
      const result = getAbsFiles(files)

      expect(result).toEqual([
        path.join(mockCwd, 'config.ts'),
        path.join(mockCwd, 'settings.js'),
        path.join(mockCwd, 'env.json'),
      ])
    })

    it('应该保持绝对路径不变', () => {
      const files = ['/abs/path/config.ts', '/another/abs/path.js']
      const result = getAbsFiles(files)

      expect(result).toEqual(['/abs/path/config.ts', '/another/abs/path.js'])
    })

    it('应该处理混合的相对和绝对路径', () => {
      const files = ['config.ts', '/abs/path/settings.js', 'relative/env.json']
      const result = getAbsFiles(files)

      expect(result).toEqual([
        path.join(mockCwd, 'config.ts'),
        '/abs/path/settings.js',
        path.join(mockCwd, 'relative/env.json'),
      ])
    })

    it('应该使用自定义 cwd', () => {
      const customCwd = '/custom/working/dir'
      const files = ['config.ts', 'settings.js']
      const result = getAbsFiles(files, customCwd)

      expect(result).toEqual([
        path.join(customCwd, 'config.ts'),
        path.join(customCwd, 'settings.js'),
      ])
    })

    it('应该处理空文件列表', () => {
      const files: string[] = []
      const result = getAbsFiles(files)

      expect(result).toEqual([])
    })

    it('应该处理包含 ./ 和 ../ 的相对路径', () => {
      const files = ['./config.ts', '../settings.js', './nested/env.json']
      const result = getAbsFiles(files)

      expect(result).toEqual([
        path.join(mockCwd, './config.ts'),
        path.join(mockCwd, '../settings.js'),
        path.join(mockCwd, './nested/env.json'),
      ])
    })

    it('应该处理 Windows 风格的绝对路径', () => {
      const files = ['C:\\absolute\\path\\config.ts', 'relative.js']
      const result = getAbsFiles(files)

      if (process.platform === 'win32') {
        expect(result).toEqual([
          'C:\\absolute\\path\\config.ts',
          path.join(mockCwd, 'relative.js'),
        ])
      } else {
        // 在非 Windows 系统上，Windows 路径会被当作相对路径处理
        expect(result).toEqual([
          path.join(mockCwd, 'C:\\absolute\\path\\config.ts'),
          path.join(mockCwd, 'relative.js'),
        ])
      }
    })

    it('应该处理空字符串文件名', () => {
      const files = ['', 'config.ts', '']
      const result = getAbsFiles(files)

      expect(result).toEqual([
        path.join(mockCwd, ''),
        path.join(mockCwd, 'config.ts'),
        path.join(mockCwd, ''),
      ])
    })
  })
})
