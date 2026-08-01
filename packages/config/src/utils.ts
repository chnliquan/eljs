import { extname, isAbsolute, resolve } from 'node:path'

/**
 * 在文件扩展名前插入环境后缀
 *
 * @remarks
 * 文件没有扩展名时直接在末尾追加后缀，空后缀保持原路径不变
 *
 * @param file - 文件路径
 * @param ext - 要插入的后缀，可包含开头的点
 * @returns 插入后缀后的文件路径
 */
export function addFileExt(file: string, ext: string): string {
  if (!ext) {
    return file
  }

  const fileExtension = extname(file)
  const suffix = ext.startsWith('.') ? ext : `.${ext}`

  if (!fileExtension) {
    return `${file}${suffix}`
  }

  return `${file.slice(0, -fileExtension.length)}${suffix}${fileExtension}`
}

/**
 * 将文件集合解析为绝对路径
 *
 * @remarks
 * 已经是绝对路径的输入保持不变，相对路径以 `cwd` 为基准解析
 *
 * @param files - 文件路径集合
 * @param cwd - 相对路径的解析基准
 * @returns 与输入顺序一致的绝对路径集合
 */
export function getAbsFiles(
  files: readonly string[],
  cwd = process.cwd(),
): string[] {
  return files.map(file => {
    return isAbsolute(file) ? file : resolve(cwd, file)
  })
}
