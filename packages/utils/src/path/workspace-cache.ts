/**
 * 工作区目录解析缓存，键同时包含绝对工作目录和返回路径模式
 * @internal
 */
export const workspaceCache = new Map<string, string[]>()

/**
 * 清除工作区目录解析缓存，仅供测试和显式生命周期重置使用
 * @internal
 */
export function clearWorkspaceCache(): void {
  workspaceCache.clear()
}
