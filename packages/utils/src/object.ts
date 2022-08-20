import { isObject } from './type'

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

export function pick<T, K extends keyof T>(
  obj: T,
  fields: K,
): { [key in K]: T[key] }
export function pick<T, K extends keyof T>(
  obj: T,
  fields: K[],
): { [key in K]: T[key] }
export function pick<T, K extends keyof T>(
  obj: T,
  fields: K | K[],
): { [key in K]: T[key] } {
  const result = Object.create(null)

  if (typeof fields === 'string' && typeof obj[fields] !== 'undefined') {
    result[fields] = obj[fields]
  } else if (Array.isArray(fields)) {
    fields.forEach(key => {
      if (typeof obj[key] !== 'undefined') {
        result[key] = obj[key]
      }
    })
  }
  return result
}

export function omit<T, K extends keyof T>(target: T, fields: K[]) {
  const shallowCopy = Object.assign({}, target)

  for (let i = 0; i < fields.length; i++) {
    const key = fields[i]
    delete shallowCopy[key]
  }

  return shallowCopy
}
