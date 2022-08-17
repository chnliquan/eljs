import chalk from 'chalk'
import conventionalChangelog from 'conventional-changelog'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { logger } from './utils/logger'

const cwd = process.cwd()
const CHANGELOG = path.join(cwd, 'CHANGELOG.md')
const LATESTLOG = path.join(cwd, 'LATESTLOG.md')

export async function generateChangelog(
  changelogPreset: string,
  latest: boolean,
  pkgName: string,
): Promise<string> {
  let hasError = false

  return new Promise((resolve, reject) => {
    let config
    try {
      config = require(changelogPreset)
    } catch (err) {
      console.log(
        chalk.redBright(
          `Can not resolve the changelog preset ${changelogPreset}.`,
        ),
      )
      process.exit(1)
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

        if (fs.existsSync(CHANGELOG)) {
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
