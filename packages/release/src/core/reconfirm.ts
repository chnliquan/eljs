import type { Preid } from '@/types'
import { getBumpVersion } from '@/utils'
import { chalk, confirm, type PkgJSON } from '@eljs/utils'

export interface ReconfirmOpts {
  cwd: string
  bumpVersion: string
  publishPkgNames: string[]
  pkgJSON: Required<PkgJSON>
  preid?: Preid
  verbose?: boolean
}

export async function reconfirm(opts: ReconfirmOpts): Promise<string> {
  const { cwd, bumpVersion, publishPkgNames, pkgJSON, preid, verbose } = opts
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
