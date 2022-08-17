import path from 'path'
import { Package } from '../types'

export function getPkgRoot(rootDir: string, pkgName: Package) {
  return path.resolve(process.cwd(), `${rootDir}${pkgName}`)
}
