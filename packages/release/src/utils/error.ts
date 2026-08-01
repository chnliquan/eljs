/**
 * 可向命令行用户直接展示的发布错误
 */
export class AppError extends Error {
  /**
   * 创建应用错误
   *
   * @param message - 面向用户的错误信息
   */
  public constructor(message: string) {
    super(message)
    this.name = 'AppError'
  }
}

/**
 * npm 发布中断时的结构化进度
 */
export interface ReleasePublishFailure {
  /**
   * 失败的包名
   */
  failedPackage: string
  /**
   * 目标版本
   */
  version: string
  /**
   * 本次执行中已经发布成功的包名
   */
  publishedPackages: readonly string[]
  /**
   * 包含失败包在内、尚未发布成功的包名
   */
  unpublishedPackages: readonly string[]
}

/**
 * npm workspace 包发布流程中断的错误
 *
 * @remarks
 * 调用方可以读取 `details` 生成恢复提示或机器可读日志
 * 默认启用 Git 提交时，即使首个包发布失败也可显式重新执行相同版本
 * 重试会复用本地发布提交和标签
 * 已经发布成功的包会在核对标签后跳过
 */
export class ReleasePublishError extends AppError {
  /**
   * 结构化发布进度
   */
  public readonly details: Readonly<ReleasePublishFailure>

  /**
   * 创建发布中断错误
   *
   * @param details - 发布进度
   * @param cause - npm publish 的原始错误
   */
  public constructor(details: ReleasePublishFailure, cause?: unknown) {
    const published = details.publishedPackages
      .map(name => `${name}@${details.version}`)
      .join(', ')
    const unpublished = details.unpublishedPackages
      .map(name => `${name}@${details.version}`)
      .join(', ')

    super(
      [
        `Failed to publish ${details.failedPackage}@${details.version}.`,
        `Published before failure: ${published || 'none'}.`,
        `Not published: ${unpublished}.`,
        'Git changes were not pushed.',
        `If the local release tag still points to HEAD, retry the exact version by running release ${details.version}.`,
      ].join(' '),
    )
    this.name = 'ReleasePublishError'
    this.details = Object.freeze({
      ...details,
      publishedPackages: Object.freeze([...details.publishedPackages]),
      unpublishedPackages: Object.freeze([...details.unpublishedPackages]),
    })
    this.cause = cause
  }
}
