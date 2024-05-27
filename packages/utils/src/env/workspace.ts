import findUp from 'find-up'
import path from 'path'

/**
 * 获取 pnpm 工作根路径
 * @param cwd 工作目录
 * @returns pnpm 根路径
 */
export async function getPnpmWorkspaceRoot(
  cwd = process.cwd(),
): Promise<string> {
  const yaml = await findUp(['pnpm-lock.yaml', 'pnpm-workspace.yaml'], {
    cwd,
  })

  return yaml ? path.dirname(yaml) : ''
}

/**
 * 获取 yarn 工作根路径
 * @param cwd 工作目录
 * @returns yarn 根路径
 */
export async function getYarnWorkspaceRoot(
  cwd = process.cwd(),
): Promise<string> {
  const lock = await findUp(['yarn.lock'], {
    cwd,
  })
  return lock ? path.dirname(lock) : ''
}

/**
 * 获取 npm 工作根路径
 * @param cwd 工作目录
 * @returns npm 根路径
 */
export async function getNpmWorkspaceRoot(
  cwd = process.cwd(),
): Promise<string> {
  const lock = await findUp(['package-lock.json'], {
    cwd,
  })
  return lock ? path.dirname(lock) : ''
}

/**
 * 获取 bun 工作根路径
 * @param cwd 工作目录
 * @returns bun 根路径
 */
export async function getBunWorkspaceRoot(
  cwd = process.cwd(),
): Promise<string> {
  const lock = await findUp(['bun.lockb'], {
    cwd,
  })
  return lock ? path.dirname(lock) : ''
}
