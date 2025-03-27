import chalk from 'chalk'
import { EOL } from 'node:os'
import readline from 'readline'
import stripAnsi from 'strip-ansi'

export const prefixes = {
  event: chalk.magenta('event') + ' -',
  info: chalk.cyan('info') + '  -',
  warn: chalk.yellow('warn') + '  -',
  error: chalk.red('error') + ' -',
  fatal: chalk.red('fatal') + ' -',
  wait: chalk.cyan('wait') + '  -',
  ready: chalk.green('ready') + ' -',
}

class Logger {
  public format(label: string, message: string) {
    return message
      .split(EOL)
      .map((line, i) => {
        return i === 0
          ? `${label} ${line}`
          : line.padStart(stripAnsi(label).length + line.length + 1)
      })
      .join(EOL)
  }

  public log(message: string, tag = ''): void {
    tag
      ? console.log(this.format(this._chalkTag(tag), message))
      : console.log(message)
  }

  public event(message: string): void {
    console.log(this.format(prefixes.event, message))
  }

  public info(message: string): void {
    console.log(this.format(prefixes.info, message))
  }

  public warn(message: string): void {
    console.warn(this.format(prefixes.warn, message))
  }

  public error(message: string): void {
    console.error(this.format(prefixes.error, message))
  }

  public fatal(message: string): void {
    console.error(this.format(prefixes.fatal, message))
  }

  public wait(message: string): void {
    console.log(this.format(prefixes.wait, message))
  }

  public ready(message: string): void {
    console.log(this.format(prefixes.ready, message))
  }

  public printErrorAndExit(message: string): void {
    this.error(message)
    process.exit(1)
  }

  public clear(title: string): void {
    if (process.stdout.isTTY) {
      const blank = EOL.repeat(process.stdout.rows)
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
        `${EOL}${chalk.gray(`>>> ${name}:`)} ${chalk.magenta.bold(message)}`,
      )
    } else {
      return (message: string) =>
        console.log(
          `${EOL}${chalk.gray(`>>> ${name}:`)} ${chalk.magenta.bold(message)}`,
        )
    }
  }

  private _chalkTag(message: string) {
    return chalk.bgBlackBright.white.dim(` ${message} `)
  }
}

export const logger = new Logger()
