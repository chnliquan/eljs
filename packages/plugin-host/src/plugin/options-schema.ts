import type { StandardSchemaV1 } from '@standard-schema/spec'

export function isOptionsSchema(value: unknown): value is StandardSchemaV1 {
  if (
    value === null ||
    (typeof value !== 'object' && typeof value !== 'function')
  ) {
    return false
  }

  const standard = (value as Partial<StandardSchemaV1>)['~standard']

  return (
    standard?.version === 1 &&
    typeof standard.vendor === 'string' &&
    typeof standard.validate === 'function'
  )
}
