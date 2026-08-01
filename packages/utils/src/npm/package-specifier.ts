/**
 * 解析后的 npm 包标识
 */
export interface ParsedPackageSpecifier {
  /** 包名 */
  name: string

  /** 版本号或版本范围 */
  version: string

  /** 命名空间 */
  scope: string

  /** 剔除命名空间后的包名 */
  unscopedName: string
}

/**
 * 解析后的 npm 包名
 * @deprecated 请改用 {@link ParsedPackageSpecifier}
 */
export type ResolvedPkgName = ParsedPackageSpecifier

/**
 * 解析 npm 包标识
 * @param specifier - 包名及可选版本
 * @returns 解析后的包名、版本、命名空间和非命名空间名称
 * @example
 * ```ts
 * parsePackageSpecifier('@eljs/utils@1.0.0')
 * // { name: '@eljs/utils', version: '1.0.0', scope: '@eljs', unscopedName: 'utils' }
 * ```
 */
export function parsePackageSpecifier(
  specifier: string,
): ParsedPackageSpecifier {
  try {
    const regex = /^(@?[^@]+)(?:@(.+))?$/
    const [, packageName = specifier, version = 'latest'] =
      specifier.match(regex) || []
    const segments = packageName.split('/')

    return {
      name: packageName,
      version,
      scope: segments.length > 1 ? segments[0] : '',
      unscopedName: segments[segments.length - 1],
    }
  } catch {
    return {
      name: specifier,
      version: 'latest',
      scope: '',
      unscopedName: specifier,
    }
  }
}

/**
 * 解析 npm 包标识
 * @param name - 包名及可选版本
 * @returns 解析后的包名、版本、命名空间和非命名空间名称
 * @deprecated 请改用 {@link parsePackageSpecifier}
 */
export function pkgNameAnalysis(name: string): ResolvedPkgName {
  return parsePackageSpecifier(name)
}
