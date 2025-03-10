import { findUp } from 'find-up'
import path from 'node:path'

/**
 * 获取 pnpm 工作目录根路径
 * @param cwd 工作目录
 * @returns pnpm 根路径
 */
export async function getPnpmWorkspaceRoot(cwd: string): Promise<string> {
  const yaml = await findUp(['pnpm-lock.yaml', 'pnpm-workspace.yaml'], {
    cwd,
  })

  return yaml ? path.dirname(yaml) : ''
}

/**
 * 获取 yarn 工作目录根路径
 * @param cwd 工作目录
 * @returns yarn 根路径
 */
export async function getYarnWorkspaceRoot(cwd: string): Promise<string> {
  const lock = await findUp(['yarn.lock'], {
    cwd,
  })
  return lock ? path.dirname(lock) : ''
}

/**
 * 获取 lerna 工作目录根路径
 * @param cwd 工作目录
 * @returns lerna 根路径
 */
export async function getLernaWorkspaceRoot(cwd: string): Promise<string> {
  const json = await findUp(['lerna.json'], {
    cwd,
  })
  return json ? path.dirname(json) : ''
}

/**
 * 获取 npm 工作目录根路径
 * @param cwd 工作目录
 * @returns npm 根路径
 */
export async function getNpmWorkspaceRoot(cwd: string): Promise<string> {
  const lock = await findUp(['package-lock.json'], {
    cwd,
  })
  return lock ? path.dirname(lock) : ''
}

/**
 * 获取 bun 工作目录根路径
 * @param cwd 工作目录
 * @returns bun 根路径
 */
export async function getBunWorkspaceRoot(cwd: string): Promise<string> {
  const lock = await findUp(['bun.lockb'], {
    cwd,
  })
  return lock ? path.dirname(lock) : ''
}

/**
 * 获取工作目录根路径
 * @param cwd 工作目录
 * @returns 工作目录根路径
 */
export async function getWorkspaceRoot(cwd: string): Promise<string> {
  return (
    (await getPnpmWorkspaceRoot(cwd)) ||
    (await getYarnWorkspaceRoot(cwd)) ||
    (await getLernaWorkspaceRoot(cwd)) ||
    (await getNpmWorkspaceRoot(cwd))
  )
}
