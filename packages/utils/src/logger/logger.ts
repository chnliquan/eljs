import chalk from 'chalk'
import readline from 'readline'
import stripAnsi from 'strip-ansi'

class Logger {
  public format(label: string, message: string) {
    return message
      .split('\n')
      .map((line, i) => {
        return i === 0
          ? `${label} ${line}`
          : line.padStart(stripAnsi(label).length + line.length + 1)
      })
      .join('\n')
  }

  public log(message: string, tag = '') {
    tag
      ? console.log(this.format(this._chalkTag(tag), message))
      : console.log(message)
  }

  public info(message: string) {
    console.log(this.format(chalk.bgBlue.black(' INFO '), message))
  }

  public warn(message: string) {
    console.warn(
      this.format(chalk.bgYellow.black(' WARN '), chalk.yellow(message)),
    )
  }

  public error(message: string) {
    console.error(this.format(chalk.bgRed(' ERROR '), chalk.red(message)))
  }

  public printErrorAndExit(message: string) {
    this.error(message)
    process.exit(1)
  }

  public done(message: string) {
    console.log(this.format(chalk.bgGreen.black(' DONE '), message))
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

  public step(name: string): (message: string) => void
  public step(name: string, message: string): void
  public step(name: string, message?: string) {
    if (message) {
      console.log(
        `\n${chalk.gray(`>>> ${name}:`)} ${chalk.magenta.bold(message)}`,
      )
    } else {
      return (message: string) =>
        console.log(
          `\n${chalk.gray(`>>> ${name}:`)} ${chalk.magenta.bold(message)}`,
        )
    }
  }

  private _chalkTag(message: string) {
    return chalk.bgBlackBright.white.dim(` ${message} `)
  }
}

export const logger = new Logger()
