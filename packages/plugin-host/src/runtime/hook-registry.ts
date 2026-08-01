import type { Hook } from '../plugin/hook'

/**
 * 按 key 保存 Hook 注册记录
 *
 * @internal
 */
export class HookRegistry {
  /**
   * Hook key 到注册记录的映射
   */
  private _hooks = new Map<string, Hook[]>()

  /**
   * 注册 Hook
   *
   * @param hook - Hook 注册记录
   */
  public register(hook: Hook): void {
    const hooks = this._hooks.get(hook.key) || []
    hooks.push(hook)
    this._hooks.set(hook.key, hooks)
  }

  /**
   * 获取指定 key 的 Hook
   *
   * @param key - Hook key
   * @returns 只读 Hook 记录集合
   */
  public get(key: string): readonly Hook[] {
    return this._hooks.get(key) || []
  }

  /**
   * 清空注册表
   */
  public clear(): void {
    this._hooks = new Map<string, Hook[]>()
  }
}
