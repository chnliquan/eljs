import { readFile } from 'node:fs/promises'
import path from 'node:path'
import semver from 'semver'
import type { AppData, WorkspacePackageJson } from '../types'
import { AppError } from '../utils'
import { resolveWorkspaceReference } from './workspace-reference'

/**
 * 通过发布前校验并按运行时依赖排序的包
 *
 * @internal
 */
export interface PublishTarget {
  /** 发布到 npm 的包名 */
  name: string
  /** 执行包管理器发布命令的源包根目录，pnpm 在此读取目录配置 */
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
 * 所有内部依赖字段的 semver 范围必须有效，指向本次发布制品时须匹配统一版本
 * workspace 显式范围须匹配目标清单版本，占位符及外部协议保持原语义
 * @throws {@link AppError}
 * 当包名重复、发布包版本不一致、依赖了不可发布的包或存在运行时循环依赖时抛出
 * @throws workspace 协议无效或目标无法解析时抛出解析错误
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
    assertDependencyRanges(target, workspacePackages, version)
  }
  const dependenciesByName = new Map(
    targets.map(target => [
      target.name,
      Object.entries(getRuntimeDependencies(target.packageJson)).flatMap(
        ([name, value]) => {
          const reference = resolveWorkspaceReference(name, value, {
            packageNames,
            rootPath: target.rootPath,
            packages: workspacePackages,
          })
          return reference ? [reference.name] : []
        },
      ),
    ]),
  )

  for (const target of targets) {
    for (const dependencyName of dependenciesByName.get(target.name) ?? []) {
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

    for (const dependencyName of dependenciesByName.get(target.name) ?? []) {
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

/**
 * 复核版本更新合同覆盖的四类内部依赖，防止 Hook 或产物重新引入旧范围
 *
 * @remarks
 * 外部获取协议沿用版本更新时的保留语义，不按本次统一版本判断
 * private 目标不属于本次发布制品，普通 dev/peer 范围只检查有效性
 */
function assertDependencyRanges(
  target: PublishTarget,
  packages: AppData['workspacePackages'],
  version: string,
): void {
  for (const field of [
    'dependencies',
    'optionalDependencies',
    'devDependencies',
    'peerDependencies',
  ] as const) {
    for (const [name, value] of Object.entries(
      target.packageJson[field] ?? {},
    )) {
      const reference = resolveWorkspaceReference(name, value, {
        packageNames: packages.map(pkg => pkg.manifest.name),
        rootPath: target.rootPath,
        packages,
      })
      if (!reference || reference.relative) continue
      const workspace = Boolean(reference.prefix)
      const dependency = packages.find(
        pkg => pkg.manifest.name === reference.name,
      )?.manifest
      if (workspace && ['*', '^', '~'].includes(reference.range)) continue
      // 这些协议由包管理器解析为外部来源，版本更新也不会将其改写为统一版本
      if (
        !workspace &&
        (/^(?:npm:|file:|link:|https?:|git(?:\+[^:]+)?:|ssh:|github:|gitlab:|bitbucket:)/i.test(
          value,
        ) ||
          /^[^@\s/:]+\/[^/\s]+(?:#.*)?$/.test(value))
      )
        continue
      if (
        !reference.range.trim() ||
        !semver.validRange(reference.range) ||
        (reference.range !== '*' &&
          (workspace || !dependency?.private) &&
          !semver.satisfies(
            workspace ? (dependency?.version ?? version) : version,
            reference.range,
          ))
      ) {
        throw new AppError(
          `Publish preflight failed: internal dependency range in ${target.name}.${field}.${name} must be valid and match the target version.`,
        )
      }
    }
  }
}

/**
 * 只读复检磁盘上的源清单和包管理器实际发布目录
 *
 * @remarks
 * 应在全部 `onBeforeRelease` 完成且 Git 提交前调用，并在每次发布前再次调用
 * pnpm 使用源清单的 `publishConfig.directory`，其他变体使用包根目录
 * 不执行 pack、发布脚本或网络请求；包名、版本及 private 状态不得偏离版本预检快照
 * 依赖图以实际发布清单重建，保留源目录作为发布命令 cwd
 * 固定 registry 不得变化；Yarn Berry 的清单优先配置必须与固定值一致
 * 其他变体使用固定 CLI registry 覆盖清单声明，未固定时拒绝新增清单 registry
 * 校验覆盖命令启动前的文件状态，包管理器自身脚本和外部并发写入仍由调用方约束
 *
 * @param appData - 当前运行数据
 * @param expected - 版本预检时固定的工作区清单和目录
 * @param version - 本次发布版本
 * @param registrySnapshot - 版本预检快照，其中 `registry: undefined` 表示不得新增地址
 * @returns 根据实际发布清单排序的目标
 * @throws 清单缺失、格式无效、发布身份或生效 registry 变化、内部范围或依赖图不安全时抛出
 * @internal
 */
export async function inspectPublishPlan(
  appData: Pick<
    AppData,
    | 'workspacePackages'
    | 'packageManager'
    | 'packageManagerVariant'
    | 'registry'
  >,
  expected: AppData['workspacePackages'],
  version: string,
  registrySnapshot: Pick<AppData, 'registry'> = appData,
): Promise<PublishTarget[]> {
  const { registry } = registrySnapshot
  if (normalizeRegistry(appData.registry) !== normalizeRegistry(registry)) {
    throw new AppError(
      'Publish preflight failed: registry changed after version preflight.',
    )
  }
  if (
    appData.workspacePackages.length !== expected.length ||
    expected.some(
      (pkg, index) =>
        pkg.rootPath !== appData.workspacePackages[index].rootPath ||
        pkg.manifestPath !== appData.workspacePackages[index].manifestPath ||
        pkg.manifest.name !== appData.workspacePackages[index].manifest.name ||
        Boolean(pkg.manifest.private) !==
          Boolean(appData.workspacePackages[index].manifest.private),
    )
  )
    throw new AppError(
      'Publish preflight failed: workspace identity changed after version preflight.',
    )

  const effectivePackages = await Promise.all(
    expected.map(async pkg => {
      const source = JSON.parse(
        await readFile(pkg.manifestPath, 'utf8'),
      ) as WorkspacePackageJson
      assertPublishIdentity(source, pkg.manifest, version)
      if (source.private) return { ...pkg, manifest: source }
      assertPublishRegistry(source, appData.packageManagerVariant, registry)
      const directory = source.publishConfig?.directory
      if (
        appData.packageManager === 'pnpm' &&
        directory !== undefined &&
        (typeof directory !== 'string' || !directory)
      ) {
        throw new AppError(
          `Publish preflight failed: invalid publishConfig.directory for ${source.name}.`,
        )
      }
      const rootPath =
        appData.packageManager === 'pnpm' && typeof directory === 'string'
          ? path.resolve(pkg.rootPath, directory)
          : pkg.rootPath
      const manifest =
        rootPath === pkg.rootPath
          ? source
          : (JSON.parse(
              await readFile(path.join(rootPath, 'package.json'), 'utf8'),
            ) as WorkspacePackageJson)
      assertPublishIdentity(manifest, pkg.manifest, version)
      assertPublishRegistry(manifest, appData.packageManagerVariant, registry)
      return { ...pkg, rootPath, manifest }
    }),
  )
  const rootsByName = new Map(
    expected.map(pkg => [pkg.manifest.name, pkg.rootPath]),
  )
  return createPublishPlan(
    { workspacePackages: effectivePackages },
    version,
  ).map(target => ({
    ...target,
    rootPath: rootsByName.get(target.name) as string,
  }))
}

function normalizeRegistry(registry: string | undefined): string | undefined {
  return registry?.replace(/\/+$/, '')
}

/**
 * 按发布命令的优先级比较生效 registry，错误不回显可能含认证信息的地址
 */
function assertPublishRegistry(
  manifest: WorkspacePackageJson,
  variant: AppData['packageManagerVariant'],
  registry: string | undefined,
): void {
  const declared = manifest.publishConfig?.registry
  if (
    declared !== undefined &&
    (variant === 'yarn-berry' || !registry) &&
    (typeof declared !== 'string' ||
      !declared ||
      normalizeRegistry(declared) !== normalizeRegistry(registry))
  ) {
    throw new AppError(
      'Publish preflight failed: effective publishConfig.registry must match the fixed release registry; align or remove the manifest declaration.',
    )
  }
}

/**
 * 比较源清单与产物清单的发布身份，私有包不要求同步目标版本
 */
function assertPublishIdentity(
  actual: WorkspacePackageJson,
  expected: WorkspacePackageJson,
  version: string,
): void {
  if (
    !actual ||
    typeof actual !== 'object' ||
    actual.name !== expected.name ||
    Boolean(actual.private) !== Boolean(expected.private) ||
    (!expected.private && actual.version !== version)
  ) {
    throw new AppError(
      `Publish preflight failed: manifest identity for ${expected.name} must remain ${expected.name}@${version} with unchanged private status.`,
    )
  }
}
