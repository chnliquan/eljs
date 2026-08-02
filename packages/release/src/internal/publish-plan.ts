import type { AppData, WorkspacePackageJson } from '../types'
import { AppError } from '../utils'

/**
 * 通过发布前校验并按运行时依赖排序的包
 *
 * @internal
 */
export interface PublishTarget {
  /** 发布到 npm 的包名 */
  name: string
  /** 执行 npm publish 的包根目录 */
  rootPath: string
  /** 已通过发布前校验的包清单 */
  packageJson: WorkspacePackageJson
}

/**
 * 校验发布清单并生成依赖优先的发布顺序
 *
 * @param appData - 已加载的工作区包数据
 * @param version - 所有发布包应具备的目标版本
 * @returns 依赖包在前、消费包在后的发布目标
 * @remarks 标记为 private 的包不会进入发布目标，但发布包不能在运行时依赖这些包
 * @throws {@link AppError}
 * 当包名重复、发布包版本不一致、依赖了不可发布的 workspace 包或存在运行时循环依赖时抛出
 * @internal
 */
export function createPublishPlan(
  appData: Pick<AppData, 'workspacePackages'>,
  version: string,
): PublishTarget[] {
  const { workspacePackages } = appData
  const packageNames = workspacePackages.map(({ manifest }) => manifest.name)

  if (new Set(packageNames).size !== packageNames.length) {
    throw new AppError(
      'Publish preflight failed: workspace package names must be unique.',
    )
  }

  const workspacePackageManifests = new Map(
    appData.workspacePackages.map(({ manifest }) => [manifest.name, manifest]),
  )
  const targets = appData.workspacePackages
    .filter(({ manifest }) => !manifest.private)
    .map(({ manifest: packageJson, rootPath }) => {
      const { name } = packageJson

      if (packageJson.version !== version) {
        throw new AppError(
          `Publish preflight failed: ${name} has version ${packageJson.version}, expected ${version}.`,
        )
      }

      return { name, packageJson, rootPath }
    })
  const targetNames = new Set(targets.map(({ name }) => name))

  for (const target of targets) {
    const runtimeDependencies = getRuntimeDependencies(target.packageJson)

    for (const dependencyName of Object.keys(runtimeDependencies)) {
      if (
        workspacePackageManifests.has(dependencyName) &&
        !targetNames.has(dependencyName)
      ) {
        throw new AppError(
          `Publish preflight failed: ${target.name} depends on non-publishable workspace package ${dependencyName}.`,
        )
      }
    }
  }

  const targetByName = new Map(targets.map(target => [target.name, target]))
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const sorted: PublishTarget[] = []

  function visit(target: PublishTarget): void {
    if (visited.has(target.name)) {
      return
    }

    if (visiting.has(target.name)) {
      throw new AppError(
        `Publish preflight failed: circular runtime dependency detected at ${target.name}.`,
      )
    }

    visiting.add(target.name)

    for (const dependencyName of Object.keys(
      getRuntimeDependencies(target.packageJson),
    )) {
      const dependency = targetByName.get(dependencyName)
      if (dependency) {
        visit(dependency)
      }
    }

    visiting.delete(target.name)
    visited.add(target.name)
    sorted.push(target)
  }

  for (const target of targets) {
    visit(target)
  }

  return sorted
}

function getRuntimeDependencies(
  packageJson: WorkspacePackageJson,
): Record<string, string> {
  return {
    ...packageJson.dependencies,
    ...packageJson.optionalDependencies,
  }
}
