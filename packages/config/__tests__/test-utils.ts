/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

/**
 * 配置测试工具模块
 * 提供统一的测试辅助函数，避免在各个测试文件中重复定义
 */

/**
 * 创建临时测试目录
 */
export function createTempDir(prefix = 'config-test-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

/**
 * 创建配置文件
 * 支持多种格式：.js, .ts, .json
 */
export function createConfigFile(
  dir: string,
  filename: string,
  content: object | string,
): string {
  const filePath = path.join(dir, filename)

  if (typeof content === 'string') {
    fs.writeFileSync(filePath, content)
  } else if (filename.endsWith('.json')) {
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2))
  } else if (filename.endsWith('.js')) {
    fs.writeFileSync(
      filePath,
      `module.exports = ${JSON.stringify(content, null, 2)}`,
    )
  } else if (filename.endsWith('.ts')) {
    fs.writeFileSync(
      filePath,
      `export default ${JSON.stringify(content, null, 2)}`,
    )
  }

  return filePath
}

/**
 * 创建带有不同导出格式的配置文件
 */
export function createConfigFileWithExports(
  dir: string,
  filename: string,
  content: object,
  useDefault = false,
): string {
  const filePath = path.join(dir, filename)

  if (filename.endsWith('.js')) {
    if (useDefault) {
      fs.writeFileSync(
        filePath,
        `module.exports = { default: ${JSON.stringify(content, null, 2)} }`,
      )
    } else {
      fs.writeFileSync(
        filePath,
        `module.exports = ${JSON.stringify(content, null, 2)}`,
      )
    }
  } else if (filename.endsWith('.ts')) {
    if (useDefault) {
      fs.writeFileSync(
        filePath,
        `export default ${JSON.stringify(content, null, 2)}`,
      )
    } else {
      fs.writeFileSync(filePath, `export = ${JSON.stringify(content, null, 2)}`)
    }
  }

  return filePath
}

/**
 * 创建原始内容的配置文件（用于测试语法错误等）
 */
export function createRawConfigFile(
  dir: string,
  filename: string,
  content: string,
): string {
  const filePath = path.join(dir, filename)
  fs.writeFileSync(filePath, content)
  return filePath
}

/**
 * 创建复杂的 JavaScript 配置文件（包含函数等）
 */
export function createJSConfigFile(
  dir: string,
  filename: string,
  jsContent: string,
): string {
  const filePath = path.join(dir, filename)
  fs.writeFileSync(filePath, jsContent)
  return filePath
}

/**
 * 清理临时目录
 */
export function cleanupDir(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true })
  } catch {
    // 忽略清理错误
  }
}

/**
 * 设置文件权限（用于权限测试）
 */
export function setFilePermissions(filePath: string, mode: number): void {
  try {
    fs.chmodSync(filePath, mode)
  } catch {
    // 在某些系统上可能无法设置权限
  }
}

/**
 * 检查文件是否存在
 */
export function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath)
  } catch {
    return false
  }
}
