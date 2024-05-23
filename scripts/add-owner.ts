/* eslint-disable @typescript-eslint/no-var-requires */
import { utils } from '@eljs/release'
import path from 'path'
import { $, argv } from 'zx'
import 'zx/globals'

import { targets } from './utils'

const owners = argv._

if (!owners.length) {
  utils.logger.printErrorAndExit('please entry owner name.')
}

;(async (): Promise<void> => {
  for (const owner of owners) {
    for (const target of targets) {
      const pkgDir = path.resolve(`packages/${target}`)
      const pkg = require(`${pkgDir}/package.json`)

      await $`pnpm owner add owner ${pkg.name}`
      utils.logger.done(`${owner} now has the owner permission of ${pkg.name}.`)
    }
  }
})()
