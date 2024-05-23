import { utils } from '@eljs/release'
import path from 'path'
import { chalk, fs } from 'zx'

export const targets = fs.readdirSync('packages').filter(file => {
  if (!utils.isDirectory(`packages/${file}`)) {
    return false
  }

  const pkgJSONPath = path.resolve(
    __dirname,
    `../packages/${file}/package.json`,
  )

  if (!fs.isPathExistSync(pkgJSONPath)) {
    return false
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pkg = require(pkgJSONPath)

  if (pkg.private) {
    return false
  }

  return true
})

export function fuzzyMatchTarget(
  partialTargets: string[],
  includeAllMatching?: boolean,
): string[] | void {
  const matched: string[] = []

  partialTargets.forEach(partialTarget => {
    for (const target of targets) {
      if (target.match(partialTarget)) {
        matched.push(target)
        if (!includeAllMatching) {
          break
        }
      }
    }
  })

  if (matched.length) {
    return matched
  } else {
    utils.logger.printErrorAndExit(
      `Target ${chalk.underline(partialTargets)} not found!`,
    )
  }
}

export function assert(v: unknown, message: string) {
  if (!v) {
    utils.logger.printErrorAndExit(message)
  }
}
