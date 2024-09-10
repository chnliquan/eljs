import type { OmitIndexSignature, PkgJSON } from '../types'
/**
 * 获取 NPM 仓库
 * @param cwd 工作目录
 */
export declare function getNpmRegistry(cwd?: string): Promise<string>
/**
 * 获取 NPM 用户
 * @param cwd 工作目录
 */
export declare function getNpmUser(cwd?: string): Promise<string>
/**
 * NPM 包信息
 * https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md
 */
export interface NpmInfo extends OmitIndexSignature<PkgJSON> {
  version: string
  name: string
  dist: {
    shasum: string
    size: number
    tarball: string
  }
  'dist-tags': {
    latest: string
    alpha: string
    beta: string
    next: string
    [key: string]: string
  }
  versions: {
    [version: string]: Omit<NpmInfo, 'versions' | 'dist-tags'>
  }
}
/**
 * 获取 NPM 包信息
 * @param name NPM 包名
 * @param opts.registry 仓库地址
 * @param opts.cwd 工作目录
 */
export declare function getNpmInfo(
  name: string,
  opts?: {
    registry?: string
    cwd?: string
  },
): Promise<Omit<NpmInfo, 'version'> | null>
/**
 * 获取指定版本的 NPM 包信息
 * @param name NPM 包名
 * @param opts.version 版本
 * @param opts.registry 仓库地址
 * @param opts.cwd 工作目录
 */
export declare function getNpmInfo(
  name: string,
  opts: {
    version: string
    registry?: string
    cwd?: string
  },
): Promise<Omit<NpmInfo, 'versions' | 'dist-tags'> | null>
/**
 * 获取 NPM 包标签
 * @param name NPM 包名
 * @param opts.cwd 工作目录
 * @param opts.registry 仓库地址
 */
export declare function getNpmDistTag(
  name: string,
  opts?: {
    cwd?: string
    registry?: string
  },
): Promise<NpmInfo['dist-tags']>
/**
 * 获取 NPM 前缀
 */
export declare function getNpmPrefix(): string
/**
 * NPM 包名信息
 */
export interface PkgNameInfo {
  /**
   * 包名
   */
  name: string
  /**
   * 版本号
   */
  version: string
  /**
   * 命名空间
   */
  scope: string
  /**
   * 剔除命名空间后的包名
   */
  unscopedName: string
}
/**
 * 解析 NPM 包名
 * @param name NPM 包名
 * @returns NPM 包信息
 * @example
 * '@eljs/utils@1.0.0' => { name: '@eljs/utils', version: '1.0.0', scope: '@eljs', unscopedName: 'utils'  }
 * 'utils@1.0.0' => { name: 'utils', version: '1.0.0, scope: '', unscopedName: 'utils'  }
 * '@eljs/utils' => { name: '@eljs/utils', version: 'latest', scope: '@eljs', unscopedName: 'utils'  }
 * 'utils' => { name: 'utils', version: 'latest', scope: '', unscopedName: 'utils'  }
 */
export declare function pkgNameAnalysis(name: string): PkgNameInfo
//# sourceMappingURL=meta.d.ts.map
