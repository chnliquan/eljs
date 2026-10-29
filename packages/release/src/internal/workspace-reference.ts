import path from 'node:path'
import semver from 'semver'

/**
 * workspace 协议解析所需的包名与目录映射
 *
 * @internal
 */
export interface WorkspaceReferenceContext {
  readonly packageNames: readonly string[]
  readonly rootPath?: string
  readonly packages?: readonly {
    rootPath: string
    manifest: { name: string }
  }[]
}

/**
 * 已确认目标的 workspace 引用，前缀用于保留别名和相对路径语义
 *
 * @internal
 */
export interface WorkspaceReference {
  readonly name: string
  readonly prefix: string
  readonly range: string
  readonly relative: boolean
}

/**
 * 解析直接范围、具名别名及相对目录形式的 workspace 目标
 *
 * @remarks
 * 相对引用必须精确命中已加载包的根目录，不访问磁盘或猜测包名
 * 普通依赖按键名匹配；显式 workspace 引用无法唯一定位时拒绝继续
 *
 * @param dependencyName - 清单中的依赖键
 * @param value - 原始依赖协议
 * @param context - 当前包目录及完整工作区映射
 * @returns workspace 引用或普通内部依赖的目标，外部依赖返回 `undefined`
 * @throws 协议无效、目标缺失或相对目录映射不唯一时抛出
 * @internal
 */
export function resolveWorkspaceReference(
  dependencyName: string,
  value: string,
  context: WorkspaceReferenceContext,
): WorkspaceReference | undefined {
  if (typeof value !== 'string') {
    throw new Error(
      `Invalid dependency version in \`${dependencyName}\`, expected a string.`,
    )
  }
  if (!value.startsWith('workspace:')) {
    return context.packageNames.includes(dependencyName)
      ? { name: dependencyName, prefix: '', range: value, relative: false }
      : undefined
  }
  const spec = value.slice('workspace:'.length)
  const invalid = () =>
    new Error(
      `Invalid workspace protocol \`${value}\` in \`${dependencyName}\`.`,
    )
  if (!spec || /\s|\\/.test(spec)) throw invalid()

  if (spec.startsWith('./') || spec.startsWith('../')) {
    if (!context.rootPath || !context.packages) throw invalid()
    const destination = path.resolve(context.rootPath, spec)
    const matches = context.packages.filter(
      pkg => path.resolve(pkg.rootPath) === destination,
    )
    if (matches.length !== 1) throw invalid()
    return {
      name: matches[0].manifest.name,
      prefix: value,
      range: '',
      relative: true,
    }
  }

  const separator = spec.lastIndexOf('@')
  const name = separator > 0 ? spec.slice(0, separator) : dependencyName
  const range = separator > 0 ? spec.slice(separator + 1) : spec
  if (
    !range ||
    !/^(@[^/@\s]+\/)?[^/@\s]+$/.test(name) ||
    !context.packageNames.includes(name) ||
    (!['*', '^', '~'].includes(range) && !semver.validRange(range))
  )
    throw invalid()
  return {
    name,
    prefix: separator > 0 ? `workspace:${name}@` : 'workspace:',
    range,
    relative: false,
  }
}
