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
