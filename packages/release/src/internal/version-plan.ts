import { safeWriteJson, type PackageJson } from '@eljs/utils'

import type {
  AppData,
  ProjectPackageJson,
  WorkspacePackageJson,
} from '../types'
import { AppError, updatePackageVersion } from '../utils'

/**
 * 单个清单在版本更新事务中的原始值和目标值
 *
 * @internal
 */
export interface PreparedVersionManifest {
  /** package.json 文件路径 */
  readonly path: string
  /** 更新前的清单快照，用于写入失败后的回滚 */
  readonly original: PackageJson
  /** 已完成版本与内部依赖校验的目标清单 */
  readonly updated: PackageJson
}

/**
 * 全部 package.json 完成内存预演后的版本更新计划
 *
 * @internal
 */
export interface PreparedVersionPlan {
  /** 目标版本 */
  readonly version: string
  /** 待写入的清单集合 */
  readonly manifests: readonly PreparedVersionManifest[]
  /** 提供给后续发布预检的 workspace 清单 */
  readonly pkgs: WorkspacePackageJson[]
  /** 版本更新前的 workspace 清单快照 */
  readonly originalPkgs: WorkspacePackageJson[]
  /** 提供给后续生命周期的根项目清单 */
  readonly projectPkg: ProjectPackageJson
  /** 版本更新前的根项目清单快照 */
  readonly originalProjectPkg: ProjectPackageJson
}

/**
 * 在不修改原对象和文件的前提下计算全部清单的目标状态
 *
 * @param appData - 当前发布流程加载的项目清单数据
 * @param version - 目标版本
 * @returns 已通过版本和内部依赖校验的更新计划
 * @throws {@link AppError}
 * 当清单、路径和包名映射不一致时抛出
 * @throws 当任一内部依赖范围无效时传播校验错误
 * @internal
 */
export async function prepareVersionPlan(
  appData: Pick<
    AppData,
    'pkgJsonPaths' | 'pkgNames' | 'pkgs' | 'projectPkg' | 'projectPkgJsonPath'
  >,
  version: string,
): Promise<PreparedVersionPlan> {
  const { projectPkgJsonPath, projectPkg, pkgNames, pkgJsonPaths, pkgs } =
    appData

  if (
    pkgNames.length !== pkgJsonPaths.length ||
    pkgNames.length !== pkgs.length
  ) {
    throw new AppError(
      'Version update preflight failed: package names, paths, and manifests are not aligned.',
    )
  }

  const manifests: PreparedVersionManifest[] = []
  const updatedPackages: WorkspacePackageJson[] = []

  // 每个对象都来自 JSON 清单，先克隆可确保后续校验失败时不污染共享状态
  for (let index = 0; index < pkgs.length; index++) {
    const original = structuredClone(pkgs[index])
    const updated = structuredClone(pkgs[index])
    await updatePackageVersion(
      pkgJsonPaths[index],
      updated,
      version,
      pkgNames,
      { write: false },
    )
    manifests.push({
      path: pkgJsonPaths[index],
      original,
      updated,
    })
    updatedPackages.push(updated as WorkspacePackageJson)
  }

  const projectPackageIndex = pkgJsonPaths.indexOf(projectPkgJsonPath)
  let updatedProjectPackage: ProjectPackageJson

  if (projectPackageIndex >= 0) {
    updatedProjectPackage = updatedPackages[
      projectPackageIndex
    ] as ProjectPackageJson
  } else {
    const original = structuredClone(projectPkg)
    const updated = structuredClone(projectPkg)
    await updatePackageVersion(
      projectPkgJsonPath,
      updated,
      version,
      undefined,
      { write: false },
    )
    manifests.push({
      path: projectPkgJsonPath,
      original,
      updated,
    })
    updatedProjectPackage = updated as ProjectPackageJson
  }

  return {
    manifests,
    originalPkgs: pkgs.map(pkg => structuredClone(pkg)),
    originalProjectPkg: structuredClone(projectPkg),
    pkgs: updatedPackages,
    projectPkg: updatedProjectPackage,
    version,
  }
}

/**
 * 将版本计划涉及的全部清单恢复为写入前的快照
 *
 * @param plan - 已写入或部分写入的版本更新计划
 * @returns 全部清单恢复完成后兑现的 Promise
 * @throws 当一个或多个清单无法恢复时抛出原始错误或聚合错误
 * @internal
 */
export async function rollbackVersionPlan(
  plan: PreparedVersionPlan,
): Promise<void> {
  const rollbackErrors: unknown[] = []

  for (const manifest of [...plan.manifests].reverse()) {
    try {
      await safeWriteJson(manifest.path, manifest.original)
    } catch (error) {
      rollbackErrors.push(error)
    }
  }

  if (rollbackErrors.length === 1) {
    throw rollbackErrors[0]
  }

  if (rollbackErrors.length > 1) {
    throw new AggregateError(
      rollbackErrors,
      'One or more package manifests could not be restored.',
    )
  }
}

/**
 * 写入已完成内存预检的版本计划
 *
 * @remarks
 * 任一写入失败时会尽力把本次已经写入的清单恢复为原始快照
 *
 * @param plan - 待提交的版本更新计划
 * @returns 全部清单写入完成后兑现的 Promise
 * @throws 当写入失败时传播原始错误，回滚同时失败时抛出聚合错误
 * @internal
 */
export async function writeVersionPlan(
  plan: PreparedVersionPlan,
): Promise<void> {
  const written: PreparedVersionManifest[] = []

  try {
    for (const manifest of plan.manifests) {
      await safeWriteJson(manifest.path, manifest.updated)
      written.push(manifest)
    }
  } catch (writeError) {
    let rollbackError: unknown

    try {
      await rollbackVersionPlan({
        ...plan,
        // 首次提交失败时，只恢复确认已写入成功的清单，避免覆盖尚未触碰的文件
        manifests: written,
      })
    } catch (error) {
      rollbackError = error
    }

    if (rollbackError) {
      throw new AggregateError(
        [writeError, rollbackError],
        'Version update failed and one or more package manifests could not be restored.',
        { cause: writeError },
      )
    }

    throw writeError
  }
}
