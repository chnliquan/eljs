import type { PackageJson } from '@eljs/utils/types'
import { AppError } from '../utils'

/**
 * 包管理器支持的发布可见性
 *
 * @internal
 */
export type PublishAccess = 'public' | 'restricted'

/**
 * 发布参数中的显式权限与其余原始参数
 *
 * @remarks 权限选项归一化后仅输出一次，其他选项及取值保持原顺序
 * @internal
 */
export interface PublishAccessArguments {
  access?: PublishAccess
  args: string[]
}

/**
 * 校验清单中的发布权限，未声明时保留包管理器默认行为
 *
 * @param value - 根或子包清单中的 access 值
 * @throws 当值不是 public、restricted 或 undefined 时抛出
 * @internal
 */
export function parsePublishAccess(value: unknown): PublishAccess | undefined {
  if (value === undefined) return undefined
  if (value !== 'public' && value !== 'restricted') {
    throw new AppError(
      'Publish preflight failed: access must be public or restricted.',
    )
  }
  return value
}

/**
 * 提取显式发布权限，拒绝歧义缩写、否定形式及相互冲突的值
 *
 * @param args - 已完成发布目标边界校验的参数
 * @returns 显式权限与移除权限选项后的参数
 * @throws 权限无效、缺值、拼写歧义或重复值冲突时抛出
 * @internal
 */
export function extractPublishAccess(
  args: readonly string[],
): PublishAccessArguments {
  let access: PublishAccess | undefined
  const remaining: string[] = []
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    const name = arg.split('=')[0]
    const normalized = name
      .toLowerCase()
      .replace(/^-+/, '--')
      .replace(/^--(?:no-)+/, '--')
    const isAccess = normalized !== '--' && '--access'.startsWith(normalized)
    if (!isAccess) {
      remaining.push(arg)
      continue
    }
    // 只接受完整的 access 选项，避免 npm 的缩写解析与其他包管理器产生不同权限
    if (name !== '--access') {
      throw new AppError(
        'Publish preflight failed: use the full --access option without negation.',
      )
    }
    const value = arg.includes('=')
      ? arg.slice(arg.indexOf('=') + 1)
      : args[++index]
    const next = parsePublishAccess(value)
    if (next === undefined || (access !== undefined && access !== next)) {
      throw new AppError(
        'Publish preflight failed: access requires one consistent public or restricted value.',
      )
    }
    access = next
  }
  return { access, args: remaining }
}

/**
 * 解析发布权限，显式 CLI 参数优先于子包，子包优先于根默认值
 *
 * @param manifest - 待发布包清单
 * @param rootAccess - 已校验的根默认权限
 * @param explicitAccess - 已校验的 CLI 权限
 * @throws 子包声明无效权限时抛出，即使 CLI 覆盖该值也会拒绝无效清单
 * @internal
 */
export function resolvePublishAccess(
  manifest: Pick<PackageJson, 'publishConfig'>,
  rootAccess?: PublishAccess,
  explicitAccess?: PublishAccess,
): PublishAccess | undefined {
  const declared = parsePublishAccess(manifest.publishConfig?.access)
  return explicitAccess ?? declared ?? rootAccess
}
