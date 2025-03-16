import { isAbsolute, join } from 'path'

/**
 * 文件增加扩展名
 * @param file 文件路径
 * @param ext 扩展名
 */
export function addFileExt(file: string, ext: string) {
  const index = file.lastIndexOf('.')
  ext = ext.startsWith('.') ? ext : `.${ext}`
  return `${file.slice(0, index)}${ext}${file.slice(index)}`
}

/**
 * 获取文件绝对路径
 * @param files 文件路径集合
 * @param cwd 当前工作目录
 */
export function getAbsFiles(files: string[], cwd = process.cwd()) {
  return files.map(file => {
    return isAbsolute(file) ? file : join(cwd, file)
  })
}
