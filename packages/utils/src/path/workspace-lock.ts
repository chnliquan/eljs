import path from 'node:path'

import { findUp } from '../module/find-up'

async function findWorkspaceRoot(
  cwd: string,
  lockFiles: string[],
): Promise<string> {
  const lockFile = await findUp(lockFiles, { cwd })
  return lockFile ? path.dirname(lockFile) : ''
}

/**
 * 获取 pnpm 工作区根目录
 *
 * @param cwd - 查找起点
 * @returns 最近的 pnpm 锁文件或工作区配置所在目录，未找到时返回空字符串
 */
export function getPnpmWorkspaceRoot(cwd: string): Promise<string> {
  return findWorkspaceRoot(cwd, ['pnpm-lock.yaml', 'pnpm-workspace.yaml'])
}

/**
 * 获取 Yarn 工作区根目录
 *
 * @param cwd - 查找起点
 * @returns 最近的 Yarn 锁文件所在目录，未找到时返回空字符串
 */
export function getYarnWorkspaceRoot(cwd: string): Promise<string> {
  return findWorkspaceRoot(cwd, ['yarn.lock'])
}

/**
 * 获取 Lerna 工作区根目录
 *
 * @param cwd - 查找起点
 * @returns 最近的 Lerna 配置所在目录，未找到时返回空字符串
 */
export function getLernaWorkspaceRoot(cwd: string): Promise<string> {
  return findWorkspaceRoot(cwd, ['lerna.json'])
}

/**
 * 获取 npm 工作区根目录
 *
 * @param cwd - 查找起点
 * @returns 最近的 npm 锁文件所在目录，未找到时返回空字符串
 */
export function getNpmWorkspaceRoot(cwd: string): Promise<string> {
  return findWorkspaceRoot(cwd, ['package-lock.json'])
}

/**
 * 获取 Bun 工作区根目录
 *
 * @param cwd - 查找起点
 * @returns 最近的 Bun 锁文件所在目录，未找到时返回空字符串
 */
export function getBunWorkspaceRoot(cwd: string): Promise<string> {
  return findWorkspaceRoot(cwd, ['bun.lock', 'bun.lockb'])
}
