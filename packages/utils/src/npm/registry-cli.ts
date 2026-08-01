import { run, type RunCommandOptions } from '../cp'

/**
 * 获取 npm registry 地址
 * @param options - 命令执行选项
 * @param scope - 优先查询专属 registry 的 npm scope
 * @returns npm 当前配置的 registry 地址
 * @throws npm 命令执行失败时抛出错误
 */
export async function getNpmRegistry(
  options?: RunCommandOptions,
  scope?: string,
): Promise<string> {
  if (scope) {
    const scopedRegistry = await run(
      'npm',
      ['config', 'get', `${scope}:registry`],
      options,
    ).then(data => normalizeRegistry(data.stdout))

    if (scopedRegistry) {
      return scopedRegistry
    }
  }

  return run('npm', ['config', 'get', 'registry'], options).then(data => {
    const registry = normalizeRegistry(data.stdout)

    if (!registry) {
      throw new Error('npm registry is not configured')
    }

    return registry
  })
}

function normalizeRegistry(value: string): string | undefined {
  const registry = value.trim()
  return registry && !['null', 'undefined'].includes(registry)
    ? registry
    : undefined
}

/**
 * 获取当前 npm 用户
 * @param options - 命令执行选项
 * @returns npm 当前登录用户名
 * @throws npm 命令执行失败或用户未登录时抛出错误
 */
export async function getNpmUser(options?: RunCommandOptions): Promise<string> {
  return run('npm', ['whoami'], options).then(data => data.stdout.trim())
}
