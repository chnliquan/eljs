import type { AppData } from '../types'

/**
 * 内置文件改动在提交入口之前的恢复与引用释放回调
 *
 * @remarks 不覆盖自定义 Hook 文件；关闭窗口后即使提交或发布失败也不再恢复
 */
interface RollbackEntry {
  restore: () => Promise<void>
  dispose: () => void
}

const pending = new WeakMap<AppData, RollbackEntry[]>()

/**
 * 登记内置文件改动，恢复时按登记的逆序执行
 *
 * @param appData - 本次发布的共享数据对象
 * @param restore - 不依赖已取消信号的恢复操作
 * @param dispose - 成功、恢复或关闭窗口时释放插件持有的快照
 * @internal
 */
export function registerPrecommitRollback(
  appData: AppData,
  restore: () => Promise<void>,
  dispose: () => void = () => {},
): void {
  const entries = pending.get(appData) ?? []
  entries.push({ restore, dispose })
  pending.set(appData, entries)
}

/**
 * 在内置提交或发布实际入口关闭恢复窗口并释放全部快照
 *
 * @param appData - 本次发布的共享数据对象
 * @internal
 */
export function closeRollbackWindow(appData: AppData): void {
  const entries = pending.get(appData)
  pending.delete(appData)
  for (const entry of entries ?? []) entry.dispose()
}

/**
 * 恢复尚未进入提交或发布入口的内置改动，重复调用无副作用
 *
 * @param appData - 本次发布的共享数据对象
 * @throws 恢复失败时聚合全部清理错误，由 runner 警告并保留原始失败
 * @internal
 */
export async function rollbackPrecommitChanges(
  appData: AppData,
): Promise<void> {
  const entries = pending.get(appData)
  pending.delete(appData)
  const errors: unknown[] = []
  for (const entry of [...(entries ?? [])].reverse()) {
    try {
      await entry.restore()
    } catch (error) {
      errors.push(error)
    } finally {
      entry.dispose()
    }
  }
  if (errors.length) {
    throw new AggregateError(errors, 'Precommit file rollback failed.')
  }
}
