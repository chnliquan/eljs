/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import deepmerge from 'deepmerge'

/**
 * 可能是部分对象
 */
export type MaybePartial<T> = Partial<T> | null | undefined

/**
 * 递归合并元组类型
 */
export type MergeAll<
  T extends readonly unknown[],
  Result = {},
> = T extends readonly [infer First, ...infer Rest]
  ? MergeAll<Rest, Result & (First extends null | undefined ? {} : First)>
  : Result

/**
 * 深度合并两个对象
 * @param a - 第一个要合并的对象
 * @param b - 第二个要合并的对象
 */
export function deepMerge<T1, T2>(
  a: MaybePartial<T1>,
  b: MaybePartial<T2>,
): T1 & T2
/**
 * 深度合并三个对象
 * @param a - 第一个要合并的对象
 * @param b - 第二个要合并的对象
 * @param c - 第三个要合并的对象
 */
export function deepMerge<T1, T2, T3>(
  a: MaybePartial<T1>,
  b: MaybePartial<T2>,
  c: MaybePartial<T3>,
): T1 & T2 & T3
/**
 * 深度合并多个对象
 * @param sources - 要合并的对象数组
 */
export function deepMerge<T extends readonly unknown[]>(
  ...sources: T
): MergeAll<T>
export function deepMerge(
  ...sources: Array<MaybePartial<Record<string, any>>>
) {
  return sources.reduce((acc: Record<string, any>, current) => {
    if (!current) {
      return acc
    }

    return deepmerge(acc, current as Record<string, any>, {
      // arrayMerge: (destinationArray: any, sourceArray: any) => sourceArray,
    })
  }, {})
}
