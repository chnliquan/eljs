import { createHash } from 'node:crypto'

/**
 * 默认缓存键的规范化节点
 *
 * @remarks
 * 类型标签用于隔离字符串、数字等值相同但类型不同的输入
 * 对象属性按名称排序，使键不受属性插入顺序影响
 *
 * @internal
 */
type CanonicalKeyNode =
  | ['array', CanonicalKeyNode[]]
  | ['bigint', string]
  | ['boolean', boolean]
  | ['hole']
  | ['null']
  | ['number', string]
  | ['object', Array<[string, CanonicalKeyNode]>]
  | ['string', string]
  | ['toJSON', CanonicalKeyNode]
  | ['undefined']

function canonicalizeKeyValue(
  value: unknown,
  ancestors: Set<object>,
): CanonicalKeyNode {
  if (value === null) {
    return ['null']
  }

  switch (typeof value) {
    case 'undefined':
      return ['undefined']
    case 'boolean':
      return ['boolean', value]
    case 'number': {
      const normalizedNumber = Object.is(value, -0)
        ? '-0'
        : Number.isNaN(value)
          ? 'NaN'
          : String(value)

      return ['number', normalizedNumber]
    }
    case 'string':
      return ['string', value]
    case 'bigint':
      return ['bigint', String(value)]
    case 'function':
    case 'symbol':
      throw new TypeError(
        `default cache key does not support ${typeof value} values`,
      )
    case 'object': {
      if (ancestors.has(value)) {
        throw new TypeError('default cache key does not support circular data')
      }

      ancestors.add(value)

      try {
        if (Object.getOwnPropertySymbols(value).length > 0) {
          throw new TypeError(
            'default cache key does not support symbol properties',
          )
        }

        const toJSON = (value as { toJSON?: unknown }).toJSON

        if (typeof toJSON === 'function') {
          return ['toJSON', canonicalizeKeyValue(toJSON.call(value), ancestors)]
        }

        if (Array.isArray(value)) {
          return [
            'array',
            Array.from({ length: value.length }, (_, index) =>
              index in value
                ? canonicalizeKeyValue(value[index], ancestors)
                : ['hole'],
            ),
          ]
        }

        const prototype = Object.getPrototypeOf(value)

        if (prototype !== Object.prototype && prototype !== null) {
          throw new TypeError(
            'default cache key only supports plain objects, arrays, and objects with toJSON',
          )
        }

        return [
          'object',
          Object.keys(value)
            .sort()
            .map(key => [
              key,
              canonicalizeKeyValue(
                (value as Record<string, unknown>)[key],
                ancestors,
              ),
            ]),
        ]
      } finally {
        ancestors.delete(value)
      }
    }
  }

  throw new TypeError('default cache key received an unsupported value')
}

/**
 * 为任意支持的数据生成类型安全且顺序稳定的默认缓存键
 *
 * @param value - 用于生成键的数据
 * @returns SHA-256 十六进制缓存键
 * @throws 数据包含函数、Symbol、循环引用、不受支持的对象类型或执行 `toJSON` 失败时抛出
 * @internal
 */
export function createDefaultCacheKey(value: unknown): string {
  const canonicalValue = canonicalizeKeyValue(value, new Set())
  return createHash('sha256')
    .update(JSON.stringify(canonicalValue))
    .digest('hex')
}
