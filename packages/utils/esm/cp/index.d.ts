/// <reference types="node" />
import cp from 'child_process'
import execa from 'execa'
export declare function parseCommand(command: string): string[]
/**
 * 执行命令
 * @param cmd 可执行命令
 * @param args 命令可传入的参数
 * @param opts 选项
 */
export declare function run(
  cmd: string,
  args: readonly string[],
  opts?: execa.Options & {
    verbose?: boolean
  },
): execa.ExecaChildProcess
/**
 * 执行命令
 * @param command 命令字符串
 * @param opts 选项
 */
export declare function runCommand(
  command: string,
  opts?: execa.Options & {
    verbose?: boolean
  },
): execa.ExecaChildProcess
export declare function getPid(cmd: string): Promise<number | null>
export interface SudoOptions {
  spawnOpts?: cp.SpawnOptions
  password?: string
  cachePassword?: boolean
  prompt?: string
}
export declare function sudo(args: string[], opts?: SudoOptions): void
export declare function getExecutableCmd(
  target: string,
  dirs?: string[],
): string | null
//# sourceMappingURL=index.d.ts.map
