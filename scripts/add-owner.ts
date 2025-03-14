import { getPackageRootPaths, logger, readJson, sleep } from '@eljs/utils'
import path from 'path'
import { $, argv } from 'zx'

$.verbose = true

main().catch((err: Error) => {
  console.error(`add owner error: ${err.message}.`)
  process.exit(1)
})

async function main(): Promise<void> {
  const owners = argv._

  if (!owners.length) {
    logger.printErrorAndExit('please entry owner name.')
  }

  const rootPath = path.resolve(__dirname, '../')
  const pkgPaths = await getPackageRootPaths(rootPath)

  for (const owner of owners) {
    for (const pkgPath of pkgPaths) {
      const { name: pkgName } = await readJson(
        path.resolve(pkgPath, 'package.json'),
      )

      try {
        await $`pnpm owner add ${owner} ${pkgName}`
        logger.done(`${owner} now has the owner permission of ${pkgName}.`)
      } catch (err) {
        await sleep(100)
        await $`npm cache clean --force`
      }
    }
  }
}
