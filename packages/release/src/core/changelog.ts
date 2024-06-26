import { isPathExistsSync, logger } from '@eljs/utils'
import conventionalChangelog from 'conventional-changelog'
import fs from 'fs'
import os from 'os'
import path from 'path'

export async function generateChangelog(opts: {
  pkgName: string
  changelogPreset: string
  latest?: boolean
  cwd?: string
}): Promise<string> {
  const { pkgName, changelogPreset, latest = true, cwd = process.cwd() } = opts
  const CHANGELOG = path.join(cwd, 'CHANGELOG.md')
  const LATESTLOG = path.join(cwd, 'LATESTLOG.md')
  let hasError = false

  return new Promise((resolve, reject) => {
    let config

    try {
      config = require(changelogPreset)
    } catch (err) {
      logger.printErrorAndExit(
        `can not resolve the changelog preset ${changelogPreset}.`,
      )
    }

    const stream = conventionalChangelog({
      config,
    })

    let changelog = ''
    let latestLog = ''

    stream.on('data', chunk => {
      try {
        let data: string = chunk.toString()

        if (data.indexOf('###') === -1) {
          data = data.replace(
            /\n+/g,
            `\n\n**Note:** Version bump only for package ${pkgName}`,
          )
        }

        if (isPathExistsSync(CHANGELOG)) {
          const remain = fs.readFileSync(CHANGELOG, 'utf8').trim()
          changelog = remain.length
            ? remain.replace(/# Change\s?Log/, '# ChangeLog \n\n' + data)
            : '# ChangeLog \n\n' + data
        } else {
          changelog = '# ChangeLog \n\n' + data
        }

        fs.writeFileSync(CHANGELOG, changelog)

        if (!latest) {
          return
        }

        const lines = data.split(os.EOL)
        let firstIndex = -1

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]

          if (/^#{1,3}/.test(line)) {
            firstIndex = i
            break
          }
        }

        if (firstIndex > -1) {
          latestLog = data.replace(/##* \[([\d.]+)\]/, '## [Changes]')

          fs.writeFileSync(LATESTLOG, latestLog)
          logger.done(`Generated LATESTLOG successfully.`)
        }
      } catch (err: any) {
        hasError = true
        reject(err.stack)
      }
    })

    stream.on('error', err => {
      if (hasError) {
        return
      }

      hasError = true
      reject(err.stack)
    })

    stream.on('end', () => {
      if (hasError) {
        return
      }

      logger.done(`Generated CHANGELOG successfully.`)
      resolve(latestLog)
    })
  })
}
