/**
 * 重试任务
 * @param fn 执行函数
 * @param retries 重试次数
 * @param delay 延时
 */
export declare function retry<T>(
  fn: () => Promise<T>,
  retries?: number,
  delay?: number,
): Promise<T>
export type MaybePromiseFunction<T> = (...args: any[]) => T | Promise<T>
/**
 * 重试直到函数返回非 undefined/null 值
 * @param fn 执行函数
 * @param retries 重试次数
 * @param delay 延时
 */
export declare function retryWithValue<T>(
  fn: MaybePromiseFunction<T | undefined | null>,
  retries?: number,
  delay?: number,
): Promise<T | undefined>
//# sourceMappingURL=retry.d.ts.map
