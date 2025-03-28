import {
  chalk,
  getWorkspaces,
  logger,
  type PackageJson,
  readJson,
  sleep,
} from '@eljs/utils'
import { EOL } from 'node:os'
import path from 'node:path'
import { $, argv } from 'zx'

$.verbose = true

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(`add owner error:${EOL}${error}`)
    process.exit(1)
  })

async function main(): Promise<void> {
  const owners = argv._

  if (!owners.length) {
    logger.printErrorAndExit('please entry owner name.')
  }

  const rootPath = path.resolve(__dirname, '../')
  const workspaces = await getWorkspaces(rootPath)

  for (const owner of owners) {
    for (const workspace of workspaces) {
      const { name: pkgName } = await readJson<PackageJson>(
        path.resolve(workspace, 'package.json'),
      )

      try {
        await $`pnpm owner add ${owner} ${pkgName}`
        logger.ready(
          `User ${chalk.cyan(owner)} now has the permission of ${pkgName}.`,
        )
      } catch (err) {
        await sleep(200)
        await $`npm cache clean --force`
      }
    }
  }
}
