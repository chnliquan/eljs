/**
 * 延期控制器
 */
export declare class Deferred<T> {
  resolve: (value: T | PromiseLike<T>) => void
  reject: (err: unknown) => void
  promise: Promise<T>
}
//# sourceMappingURL=deferred.d.ts.map
