/**
 * 基础 git 仓库信息
 */
export interface BaseGitRepoInfo {
  /**
   * git 仓库名称
   */
  name: string
  /**
   * git 仓库所属的组
   */
  group: string
  /**
   * git 仓库网页地址
   */
  href: string
  /**
   * git url
   */
  url: string
}
/**
 * git 仓库信息
 */
export interface GitRepoInfo extends BaseGitRepoInfo {
  /**
   * git 仓库克隆地址
   */
  url: string
  /**
   * git 仓库分支
   */
  branch: string
  /**
   * git 仓库作者
   */
  author: string
  /**
   * 仓库邮箱
   */
  email: string
}
/**
 * 获取指定目录的 git 地址
 * @param cwd 当前工作目录
 * @param exact 是否在当前目录下提取
 */
export declare function getGitUrl(cwd: string, exact?: boolean): string
/**
 * 获取指定工作目录的 git 分支
 * @param cwd 当前工作目录
 * @returns 当前分支
 */
export declare function getGitBranch(cwd?: string): Promise<string>
/**
 * 解析 git 地址
 * @param url git 地址
 */
export declare function gitUrlAnalysis(url: string): BaseGitRepoInfo
/**
 * 获取指定目录的 git 仓库信息
 * @param dir 指定的目录
 * @param exact 是否在当前目录下提取
 */
export declare function getGitRepoInfo(
  dir: string,
  exact?: boolean,
): GitRepoInfo | null
/**
 * git 用户
 */
export interface GitUser {
  /**
   * 用户名
   */
  name: string
  /**
   * 用户邮箱
   */
  email: string
}
/**
 * 获取 git 用户
 */
export declare function getGitUser(): GitUser
//# sourceMappingURL=meta.d.ts.map
