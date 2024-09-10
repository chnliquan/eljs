/**
 * 指定工作目录的 git 是否干净
 * @param cwd 工作目录
 */
export declare function isGitClean(cwd?: string): Promise<boolean>
/**
 * 指定工作目录的 git 是否落后远程
 * @param cwd 工作目录
 */
export declare function isGitBehindRemote(cwd?: string): Promise<boolean>
/**
 * 指定工作目录的 git 是否超前远程
 * @param cwd 工作目录
 */
export declare function isGitAheadRemote(cwd?: string): Promise<boolean>
/**
 * 当前分支是否为传入的分支
 * @param branch 分支名
 * @param cwd 工作目录
 */
export declare function isGitBranch(
  branch: string,
  cwd?: string,
): Promise<boolean>
//# sourceMappingURL=is.d.ts.map
