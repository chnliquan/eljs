import chalk from 'chalk'
import readline from 'readline'
import stripAnsi from 'strip-ansi'

function format(label: string, msg: string) {
  return msg
    .split('\n')
    .map((line, i) => {
      return i === 0
        ? `${label} ${line}`
        : line.padStart(stripAnsi(label).length + line.length + 1)
    })
    .join('\n')
}

function chalkTag(msg: string) {
  return chalk.bgBlackBright.white.dim(` ${msg} `)
}

function log(msg = '', tag = '') {
  tag ? console.log(format(chalkTag(tag), msg)) : console.log(msg)
}

function info(msg: string) {
  console.log(format(chalk.bgBlue.black(' INFO '), msg))
}

function done(msg: string) {
  console.log(format(chalk.bgGreen.black(' DONE '), msg))
}

function warn(msg: string) {
  console.warn(format(chalk.bgYellow.black(' WARN '), chalk.yellow(msg)))
}

function error(msg: string) {
  console.error(format(chalk.bgRed(' ERROR '), chalk.red(msg)))
}

function printErrorAndExit(msg: string) {
  error(msg)
  process.exit(1)
}

function clearConsole(title: string) {
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

function step(name: string): (msg: string) => void
function step(name: string, msg: string): void
function step(name: string, msg?: string) {
  if (msg) {
    console.log(`\n${chalk.gray(`>>> ${name}:`)} ${chalk.magenta.bold(msg)}`)
  } else {
    return (msg: string) =>
      console.log(`\n${chalk.gray(`>>> ${name}:`)} ${chalk.magenta.bold(msg)}`)
  }
}

export const logger = {
  log,
  info,
  done,
  warn,
  error,
  printErrorAndExit,
  step,
  clearConsole,
}
