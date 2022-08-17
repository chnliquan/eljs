/* eslint-disable @typescript-eslint/no-explicit-any */
import co from 'co'
import { isGeneratorFunc, isObject } from './type'

export function stripBlankLines(str: string): string {
  return str.replace(/(\n[\s|\t]*\r*\n)/g, '\n')
}

export interface ArrayIterator<T, R> {
  (value: T, index: number, collection: T[]): R
}

export interface ObjectIterator<T, R> {
  (value: T[keyof T], key: string, target: T): R
}

export function forEach<T>(
  target: T[],
  iteratee: ArrayIterator<T, unknown>,
): number | null
export function forEach<T extends Record<string, unknown>>(
  target: T,
  iteratee: ObjectIterator<T, unknown>,
): string | null
export function forEach(
  target: unknown,
  iteratee: unknown,
  ctx?: unknown,
): string | number | null {
  if (!target || typeof iteratee !== 'function') {
    return null
  }

  ctx = ctx || null

  if (typeof target !== 'object') {
    target = [target]
  }

  if (Array.isArray(target)) {
    for (let i = 0; i < target.length; i++) {
      if (iteratee.call(ctx, target[i], i, target)) {
        return i
      }
    }
  } else if (target && typeof target === 'object') {
    for (const key of Object.keys(target)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (iteratee.call(ctx, (target as any)[key], key, target)) {
        return key
      }
    }
  }
  return null
}

export function merge<Target, Source>(
  target: Target,
  source: Source,
): Target & Source
export function merge<Target, Source1, Source2>(
  target: Target,
  source1: Source1,
  source2: Source2,
): Target & Source1 & Source2
export function merge<Target, Source1, Source2, Source3>(
  target: Target,
  source1: Source1,
  source2: Source2,
  source3: Source3,
): Target & Source1 & Source2 & Source3
export function merge(target: any, ...args: any[]): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let result: any = target

  if (typeof target !== 'object') {
    result = Object.create(null)
  }

  const assignValue = (value: unknown, key: string | number): void => {
    // 处理循环引用
    if (value === target) {
      return
    }

    const previousValue = result[key]

    if (typeof previousValue === 'object' && typeof value === 'object') {
      result[key] = merge(previousValue, value)
    } else {
      result[key] = value
    }
  }

  args.forEach(item => forEach(item, assignValue))
  return result
}

export function deepMerge<Target, Source>(
  target: Target,
  source: Source,
): Target & Source
export function deepMerge<Target, Source1, Source2>(
  target: Target,
  source1: Source1,
  source2: Source2,
): Target & Source1 & Source2
export function deepMerge<Target, Source1, Source2, Source3>(
  target: Target,
  source1: Source1,
  source2: Source2,
  source3: Source3,
): Target & Source1 & Source2 & Source3
export function deepMerge(
  target: any,
  ...args: any[]
): Record<string, unknown> {
  function clone(item: unknown, to: unknown) {
    if (Array.isArray(item)) {
      return deepMerge(to && Array.isArray(to) ? to : [], item)
    } else if (isObject(item)) {
      return deepMerge(to && isObject(to) ? to : {}, item)
    } else {
      return item
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let result: any = target

  if (!target) {
    result = Object.create(null)
  }

  for (let i = 0; i < args.length; i++) {
    const current = args[i]

    if (Array.isArray(target)) {
      if (!Array.isArray(current)) {
        continue
      } else {
        target.length = 0
      }

      for (let i = 0; i < current.length; i++) {
        target[i] = clone(current[i], target[i])
      }
    } else if (target && typeof target === 'object') {
      for (const name in current) {
        if (!Object.prototype.hasOwnProperty.call(current, name)) {
          continue
        }

        result[name] = clone(current[name], result[name])
      }
    }
  }

  return result
}

export interface GeneratorFunc {
  (...args: unknown[]): Iterator<unknown>
}

export function wrapGenerator(func: GeneratorFunc): unknown {
  if (isGeneratorFunc(func)) {
    return co.wrap(func)
  }
  return func
}
