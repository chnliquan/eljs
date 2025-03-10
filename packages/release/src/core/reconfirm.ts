import type { Preid } from '@/types'
import { chalk, confirm, type PackageJson } from '@eljs/utils'
import { getBumpVersion } from './bump'

export interface ReconfirmOpts {
  cwd: string
  registry: string
  canary: boolean
  bumpVersion: string
  publishPkgNames: string[]
  pkgJSON: Required<PackageJson>
  preid?: Preid
  verbose?: boolean
}

export async function reconfirm(opts: ReconfirmOpts): Promise<string> {
  const {
    cwd,
    registry,
    canary,
    bumpVersion,
    publishPkgNames,
    pkgJSON,
    preid,
    verbose,
  } = opts
  let confirmMessage = ''

  if (publishPkgNames.length === 1 || !verbose) {
    confirmMessage = `Are you sure to bump the version to ${chalk.cyanBright(
      bumpVersion,
    )}`
  } else {
    console.log(chalk.bold('The packages to be bumped are as follows:'))
    publishPkgNames.forEach(pkgName =>
      console.log(` - ${chalk.cyanBright(`${pkgName}@${bumpVersion}`)}`),
    )
    confirmMessage = 'Are you sure to bump?'
  }

  const answer = await confirm(confirmMessage)

  if (answer) {
    return bumpVersion
  } else {
    const version = await getBumpVersion({
      cwd,
      registry,
      canary,
      pkgJSON,
      publishPkgNames,
      preid,
    })
    return reconfirm({
      ...opts,
      bumpVersion: version,
    })
  }
}
