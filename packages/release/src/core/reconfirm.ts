import { chalk, confirm, PkgJSON } from '@eljs/utils'
import { getBumpVersion } from '../prompt'
import { PublishTag } from '../types'

export interface ReconfirmOpts {
  bumpVersion: string
  publishPkgNames: string[]
  pkgJSON: Required<PkgJSON>
  tag?: PublishTag
  verbose?: boolean
}

export async function reconfirm(opts: ReconfirmOpts): Promise<string> {
  const { bumpVersion, publishPkgNames, pkgJSON, tag, verbose } = opts
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
      pkgJSON,
      publishPkgNames,
      tag,
    })
    return reconfirm({
      ...opts,
      bumpVersion: version,
    })
  }
}
