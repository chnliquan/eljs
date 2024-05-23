/**
 * 延期控制器
 */
export class Deferred<T> {
  public resolve!: (value: T | PromiseLike<T>) => void
  public reject!: (err: unknown) => void

  public promise = new Promise<T>((resolve, reject) => {
    this.resolve = resolve
    this.reject = reject
  })
}
