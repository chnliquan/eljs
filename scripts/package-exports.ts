/**
 * 表示已读取包清单中的导出目标，保留条件嵌套、数组回退与 null 排除项
 *
 * @remarks
 * 调用方负责读取可信且符合 Node exports 结构的 JSON，本类型不执行清单结构校验
 * @internal
 */
export type ExportTarget =
  string | null | ExportTarget[] | { [condition: string]: ExportTarget }

/**
 * 将根字符串、条件、数组导出与子路径映射统一为入口列表，保留声明顺序和排除项
 *
 * @param exports - 已读取包清单中的 exports，缺省时返回空列表
 * @returns 根导出以 `.` 为键的列表，或原始子路径映射
 * @internal
 */
export function getExportEntries(
  exports: ExportTarget | undefined,
): Array<[string, ExportTarget]> {
  if (exports === undefined) return []
  return exports &&
    !Array.isArray(exports) &&
    typeof exports === 'object' &&
    Object.keys(exports).some(key => key.startsWith('.'))
    ? Object.entries(exports)
    : [['.', exports]]
}

/**
 * 按实际 tarball 文件清单检查具体导出目标，不读取文件或启动子进程
 *
 * @remarks
 * 输入须为合法的 Node 导出定义与使用正斜线的 tarball 相对路径
 * 子路径键包含星号时明确报不支持错误，包括目标为 null 的排除项
 * 具体键目标中的星号按字面文件名检查，null 不产生文件要求
 * 严格要求所有正向条件及数组候选文件存在，不模拟运行时条件选择或数组回退
 *
 * @param packageName - 用于错误定位的包名称
 * @param exports - 已读取包清单中的导出定义
 * @param packedFiles - 实际打包结果中的文件路径集合，不以工作区文件代替
 * @throws 子路径键包含星号或任一正向目标不在 tarball 文件清单中时抛出错误
 * @internal
 */
export function assertExportTargets(
  packageName: string,
  exports: ExportTarget,
  packedFiles: ReadonlySet<string>,
): void {
  for (const [key, target] of getExportEntries(exports)) {
    if (key.includes('*')) {
      throw new Error(
        `${packageName} has unsupported export subpath pattern ${key}.`,
      )
    }

    for (const targetFile of collectExportTargets(target)) {
      const file = targetFile.replace(/^\.\//, '')
      if (!packedFiles.has(file)) {
        throw new Error(
          `${packageName} is missing ${file} from its published tarball.`,
        )
      }
    }
  }
}

function collectExportTargets(target: ExportTarget): string[] {
  if (typeof target === 'string') return [target]
  if (!target || typeof target !== 'object') return []
  return Object.values(target).flatMap(collectExportTargets)
}
