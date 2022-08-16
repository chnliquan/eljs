const path = require('path')
const { minimist, logger, run } = require('@eljs/node-utils')
const { targets } = require('./utils')

const args = minimist(process.argv.slice(2))
const owners = args._

if (!owners.length) {
  logger.printErrorAndExit('please entry owner name.')
}

main()

async function main() {
  for (const owner of owners) {
    for (const target of targets) {
      const pkgDir = path.resolve(`packages/${target}`)
      const pkg = require(`${pkgDir}/package.json`)

      await run('pnpm', ['owner', 'add', owner, pkg.name])
      logger.done(`${owner} now has the owner permission of ${pkg.name}.`)
    }
  }
}
