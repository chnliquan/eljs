/**
 * 下载选项
 */
export interface DownloadGitRepoOpts {
  /**
   * 分支
   */
  branch?: string
  /**
   * 目标路径
   */
  dest?: string
}
/**
 * 下载 git 仓库
 * @param url git 地址
 * @param opts 下载选项
 */
export declare function downloadGitRepo(
  url: string,
  opts?: DownloadGitRepoOpts,
): Promise<string>
//# sourceMappingURL=download.d.ts.map
