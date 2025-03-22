/**
 * 应用错误
 */
export class AppError extends Error {
  public constructor(message: string) {
    super(message)
    this.name = 'AppError'
  }
}
