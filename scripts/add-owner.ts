/* eslint-disable @typescript-eslint/no-var-requires */
import { logger } from '@eljs/utils'
import path from 'path'
import { $, argv } from 'zx'

import { targets } from './utils'

const owners = argv._

if (!owners.length) {
  logger.printErrorAndExit('please entry owner name.')
}

;(async (): Promise<void> => {
  for (const owner of owners) {
    for (const target of targets) {
      const pkgDir = path.resolve(`packages/${target}`)
      const pkg = require(`${pkgDir}/package.json`)

      await $`pnpm owner add owner ${pkg.name}`
      logger.done(`${owner} now has the owner permission of ${pkg.name}.`)
    }
  }
})()
