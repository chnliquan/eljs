import path from 'path'
import { readJSONSync } from './file'

export function resolvePkg(context: string): Record<string, unknown> {
  const pkgPath = path.join(context, 'package.json')
  return readJSONSync(pkgPath)
}
