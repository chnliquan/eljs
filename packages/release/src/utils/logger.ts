import chalk from 'chalk'

function chalkTag(msg: string) {
  return chalk.bgBlackBright.white.dim(` ${msg} `)
}

function log(msg = '', tag = '') {
  tag ? console.log(chalkTag(tag), msg) : console.log(msg)
}

function info(msg: string) {
  console.log(chalk.bgBlue.black(' INFO '), msg)
}

function done(msg: string) {
  console.log(chalk.bgGreen.black(' DONE '), msg)
}

function warn(msg: string) {
  console.warn(chalk.bgYellow.black(' WARN '), chalk.yellow(msg))
}

function error(msg: string) {
  console.error(chalk.bgRed(' ERROR '), chalk.red(msg))
}

function printErrorAndExit(msg: string) {
  error(msg)
  process.exit(1)
}

export function step(msg: string, tag = 'Release') {
  console.log(`\n${chalk.gray(`>>> ${tag}:`)} ${chalk.magenta.bold(msg)}`)
}

export const logger = {
  log,
  info,
  done,
  warn,
  error,
  printErrorAndExit,
  step,
}
