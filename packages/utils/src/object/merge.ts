import deepmerge from 'deepmerge'

export function deepMerge<T1, T2>(a: Partial<T1>, b: Partial<T2>): T1 & T2
export function deepMerge<T1, T2, T3>(
  a: Partial<T1>,
  b: Partial<T2>,
  c: Partial<T3>,
): T1 & T2 & T3
export function deepMerge<T1, T2, T3, T4>(
  a: Partial<T1>,
  b: Partial<T2>,
  c: Partial<T3>,
  d: Partial<T4>,
): T1 & T2 & T3 & T4
export function deepMerge<T1, T2, T3, T4, T5>(
  a: Partial<T1>,
  b: Partial<T2>,
  c: Partial<T3>,
  d: Partial<T4>,
  e: Partial<T5>,
): T1 & T2 & T3 & T4 & T5
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deepMerge(...sources: any[]) {
  return sources.reduce((acc, current) => {
    if (!current) {
      return acc
    }
    return deepmerge(acc, current)
  }, {})
}
