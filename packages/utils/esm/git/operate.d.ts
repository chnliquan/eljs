import execa from 'execa'
/**
 * 提交 git 信息
 * @param msg 提交信息
 * @param opts 选项
 */
export declare function gitCommit(
  msg: string,
  opts?: execa.Options & {
    verbose?: boolean
  },
): Promise<void>
/**
 * 同步 git commit 到远端
 * @param opts 选项
 */
export declare function gitPushCommit(
  opts?: execa.Options & {
    verbose?: boolean
  },
): Promise<void>
/**
 * git tag
 * @param tag 标签
 * @param opts 选项
 */
export declare function gitTag(
  tag: string,
  opts?: execa.Options & {
    verbose?: boolean
  },
): Promise<void>
/**
 * 同步 git tag 到远端
 * @param tag 标签
 * @param opts 选项
 */
export declare function gitPushTag(
  tag: string,
  opts?: execa.Options & {
    verbose?: boolean
  },
): Promise<void>
//# sourceMappingURL=operate.d.ts.map
