import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import {
  isDirectory,
  isDirectorySync,
  isFile,
  isFileSync,
  isPathExists,
  isPathExistsSync,
  isSymlink,
  isSymlinkSync,
} from '../../src/file/is'
import { fstat, fstatSync } from '../../src/file/meta'

describe('文件工具函数', () => {
  let tempDir: string
  let testFile: string
  let testDir: string
  let testSymlink: string

  beforeEach(async () => {
    // 为测试创建临时目录
    tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'file-utils-test-'))
    testFile = path.join(tempDir, 'test-file.txt')
    testDir = path.join(tempDir, 'test-dir')
    testSymlink = path.join(tempDir, 'test-symlink')

    // 创建测试文件
    await fsp.writeFile(testFile, '测试内容')

    // 创建测试目录
    await fsp.mkdir(testDir)

    // 创建测试符号链接（仅在支持的系统上）
    try {
      await fsp.symlink(testFile, testSymlink)
    } catch (error) {
      // 符号链接可能在所有系统上都不受支持
    }
  })

  afterEach(async () => {
    // 清理临时目录
    try {
      await fsp.rm(tempDir, { recursive: true, force: true })
    } catch (error) {
      // 忽略清理错误
    }
  })

  describe('fstat 和 fstatSync 文件状态', () => {
    describe('fstat 异步文件状态', () => {
      it('应该返回现有文件的文件状态', async () => {
        const stats = await fstat(testFile)
        expect(stats).toBeInstanceOf(fs.Stats)
        expect(stats.isFile()).toBe(true)
        expect(stats.isDirectory()).toBe(false)
      })

      it('应该返回现有目录的目录状态', async () => {
        const stats = await fstat(testDir)
        expect(stats).toBeInstanceOf(fs.Stats)
        expect(stats.isFile()).toBe(false)
        expect(stats.isDirectory()).toBe(true)
      })

      it('应该在 symlink=true 时处理符号链接', async () => {
        if (await isPathExists(testSymlink)) {
          const stats = await fstat(testSymlink, true)
          expect(stats).toBeInstanceOf(fs.Stats)
          expect(stats.isSymbolicLink()).toBe(true)
        }
      })

      it('应该在 symlink=false 时跟随符号链接', async () => {
        if (await isPathExists(testSymlink)) {
          const stats = await fstat(testSymlink, false)
          expect(stats).toBeInstanceOf(fs.Stats)
          expect(stats.isFile()).toBe(true) // 应该跟随到目标文件
        }
      })

      it('应该为不存在的文件抛出错误', async () => {
        const nonExistentFile = path.join(tempDir, 'non-existent.txt')
        await expect(fstat(nonExistentFile)).rejects.toThrow(/Stat .* failed/)
      })
    })

    describe('fstatSync 同步文件状态', () => {
      it('应该返回现有文件的文件状态', () => {
        const stats = fstatSync(testFile)
        expect(stats).toBeInstanceOf(fs.Stats)
        expect((stats as fs.Stats).isFile()).toBe(true)
        expect((stats as fs.Stats).isDirectory()).toBe(false)
      })

      it('应该返回现有目录的目录状态', () => {
        const stats = fstatSync(testDir)
        expect(stats).toBeInstanceOf(fs.Stats)
        expect((stats as fs.Stats).isFile()).toBe(false)
        expect((stats as fs.Stats).isDirectory()).toBe(true)
      })

      it('应该为不存在的文件抛出错误', () => {
        const nonExistentFile = path.join(tempDir, 'non-existent.txt')
        expect(() => fstatSync(nonExistentFile)).toThrow(/Stat .* failed/)
      })
    })
  })

  describe('文件类型检查函数', () => {
    describe('isFile 文件检查', () => {
      it('应该对文件返回 true', async () => {
        expect(await isFile(testFile)).toBe(true)
      })

      it('应该对目录返回 false', async () => {
        expect(await isFile(testDir)).toBe(false)
      })

      it('应该对不存在的路径返回 false', async () => {
        expect(await isFile(path.join(tempDir, 'non-existent.txt'))).toBe(false)
      })

      it('应该跟随符号链接到文件', async () => {
        if (await isPathExists(testSymlink)) {
          expect(await isFile(testSymlink)).toBe(true)
        }
      })
    })

    describe('isFileSync 同步文件检查', () => {
      it('应该对文件返回 true', () => {
        expect(isFileSync(testFile)).toBe(true)
      })

      it('应该对目录返回 false', () => {
        expect(isFileSync(testDir)).toBe(false)
      })

      it('应该对不存在的路径返回 false', () => {
        expect(isFileSync(path.join(tempDir, 'non-existent.txt'))).toBe(false)
      })
    })

    describe('isDirectory 目录检查', () => {
      it('应该对目录返回 true', async () => {
        expect(await isDirectory(testDir)).toBe(true)
      })

      it('应该对文件返回 false', async () => {
        expect(await isDirectory(testFile)).toBe(false)
      })

      it('应该对不存在的路径返回 false', async () => {
        expect(await isDirectory(path.join(tempDir, 'non-existent-dir'))).toBe(
          false,
        )
      })
    })

    describe('isDirectorySync 同步目录检查', () => {
      it('应该对目录返回 true', () => {
        expect(isDirectorySync(testDir)).toBe(true)
      })

      it('应该对文件返回 false', () => {
        expect(isDirectorySync(testFile)).toBe(false)
      })

      it('应该对不存在的路径返回 false', () => {
        expect(isDirectorySync(path.join(tempDir, 'non-existent-dir'))).toBe(
          false,
        )
      })
    })

    describe('isSymlink 符号链接检查', () => {
      it('应该对符号链接返回 true', async () => {
        if (await isPathExists(testSymlink)) {
          expect(await isSymlink(testSymlink)).toBe(true)
        }
      })

      it('应该对普通文件返回 false', async () => {
        expect(await isSymlink(testFile)).toBe(false)
      })

      it('应该对目录返回 false', async () => {
        expect(await isSymlink(testDir)).toBe(false)
      })

      it('应该对不存在的路径返回 false', async () => {
        expect(await isSymlink(path.join(tempDir, 'non-existent.txt'))).toBe(
          false,
        )
      })
    })

    describe('isSymlinkSync 同步符号链接检查', () => {
      it('应该对符号链接返回 true', () => {
        if (fs.existsSync(testSymlink)) {
          expect(isSymlinkSync(testSymlink)).toBe(true)
        }
      })

      it('应该对普通文件返回 false', () => {
        expect(isSymlinkSync(testFile)).toBe(false)
      })

      it('应该对目录返回 false', () => {
        expect(isSymlinkSync(testDir)).toBe(false)
      })
    })

    describe('isPathExists 路径存在检查', () => {
      it('应该对现有文件返回 true', async () => {
        expect(await isPathExists(testFile)).toBe(true)
      })

      it('应该对现有目录返回 true', async () => {
        expect(await isPathExists(testDir)).toBe(true)
      })

      it('应该对现有符号链接返回 true', async () => {
        if (fs.existsSync(testSymlink)) {
          expect(await isPathExists(testSymlink)).toBe(true)
        }
      })

      it('应该对不存在的路径返回 false', async () => {
        expect(await isPathExists(path.join(tempDir, 'non-existent.txt'))).toBe(
          false,
        )
      })
    })

    describe('isPathExistsSync 同步路径存在检查', () => {
      it('应该对现有文件返回 true', () => {
        expect(isPathExistsSync(testFile)).toBe(true)
      })

      it('应该对现有目录返回 true', () => {
        expect(isPathExistsSync(testDir)).toBe(true)
      })

      it('应该对现有符号链接返回 true', () => {
        if (fs.existsSync(testSymlink)) {
          expect(isPathExistsSync(testSymlink)).toBe(true)
        }
      })

      it('应该对不存在的路径返回 false', () => {
        expect(isPathExistsSync(path.join(tempDir, 'non-existent.txt'))).toBe(
          false,
        )
      })
    })
  })

  describe('边界情况', () => {
    it('应该优雅地处理空字符串路径', async () => {
      expect(await isFile('')).toBe(false)
      expect(await isDirectory('')).toBe(false)
      expect(await isSymlink('')).toBe(false)
      expect(await isPathExists('')).toBe(false)
    })

    it('应该优雅地处理权限错误', async () => {
      // 这个测试可能在所有系统上都不工作，但提供了覆盖率
      const restrictedPath = '/root/.ssh/id_rsa'
      expect(await isFile(restrictedPath)).toBe(false)
      expect(await isDirectory(restrictedPath)).toBe(false)
    })

    it('应该处理非常长的路径', async () => {
      const longPath = path.join(tempDir, 'a'.repeat(255))
      expect(await isFile(longPath)).toBe(false)
      expect(await isDirectory(longPath)).toBe(false)
    })
  })
})
