import mkdirp from 'mkdirp'
/**
 * 同步创建文件夹
 * @param dir 文件夹路径
 * @param mode 文件夹类型
 */
export declare function mkdirSync(dir: string, mode?: mkdirp.Mode): string
/**
 * 异步创建文件夹
 * @param dir 文件夹路径
 * @param mode 文件夹类型
 */
export declare function mkdir(dir: string, mode?: mkdirp.Mode): Promise<string>
/**
 * 创建临时文件夹
 * @param random 是否随机生成
 */
export declare function tmpdir(random?: boolean): string
//# sourceMappingURL=dir.d.ts.map
