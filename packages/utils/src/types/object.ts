/* eslint-disable @typescript-eslint/ban-types */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never

/**
 * 去除索引签名
 */
export type OmitIndexSignature<ObjectType> = {
  [
    KeyType in keyof ObjectType as {} extends Record<KeyType, unknown>
      ? never
      : KeyType
  ]: ObjectType[KeyType]
}

/**
 * 递归使 T 中的所有属性成为必需的
 */
export type RequiredRecursive<T> = T extends Function
  ? T
  : T extends object
    ? {
        [P in keyof T]-?: Exclude<T[P], undefined> extends infer U
          ? U extends object
            ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
              U extends any[]
              ? U
              : RequiredRecursive<U>
            : U
          : never
      }
    : T
