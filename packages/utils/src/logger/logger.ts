import chalk from 'chalk'
import readline from 'readline'
import stripAnsi from 'strip-ansi'

class Logger {
  public format(label: string, msg: string) {
    return msg
      .split('\n')
      .map((line, i) => {
        return i === 0
          ? `${label} ${line}`
          : line.padStart(stripAnsi(label).length + line.length + 1)
      })
      .join('\n')
  }

  public log(msg: string, tag = '') {
    tag ? console.log(this.format(this._chalkTag(tag), msg)) : console.log(msg)
  }

  public info(msg: string) {
    console.log(this.format(chalk.bgBlue.black(' INFO '), msg))
  }

  public warn(msg: string) {
    console.warn(this.format(chalk.bgYellow.black(' WARN '), chalk.yellow(msg)))
  }

  public error(msg: string) {
    console.error(this.format(chalk.bgRed(' ERROR '), chalk.red(msg)))
  }

  public printErrorAndExit(msg: string) {
    this.error(msg)
    process.exit(1)
  }

  public done(msg: string) {
    console.log(this.format(chalk.bgGreen.black(' DONE '), msg))
  }

  public clear(title: string) {
    if (process.stdout.isTTY) {
      const blank = '\n'.repeat(process.stdout.rows)
      console.log(blank)
      readline.cursorTo(process.stdout, 0, 0)
      readline.clearScreenDown(process.stdout)

      if (title) {
        console.log(title)
      }
    }
  }

  public step(name: string): (msg: string) => void
  public step(name: string, msg: string): void
  public step(name: string, msg?: string) {
    if (msg) {
      console.log(`\n${chalk.gray(`>>> ${name}:`)} ${chalk.magenta.bold(msg)}`)
    } else {
      return (msg: string) =>
        console.log(
          `\n${chalk.gray(`>>> ${name}:`)} ${chalk.magenta.bold(msg)}`,
        )
    }
  }

  private _chalkTag(msg: string) {
    return chalk.bgBlackBright.white.dim(` ${msg} `)
  }
}

export const logger = new Logger()
