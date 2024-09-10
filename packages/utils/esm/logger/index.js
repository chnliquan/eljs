import chalk from 'chalk';
import readline from 'readline';
import stripAnsi from 'strip-ansi';
function format(label, msg) {
  return msg.split('\n').map(function (line, i) {
    return i === 0 ? "".concat(label, " ").concat(line) : line.padStart(stripAnsi(label).length + line.length + 1);
  }).join('\n');
}
function chalkTag(msg) {
  return chalk.bgBlackBright.white.dim(" ".concat(msg, " "));
}
function log() {
  var msg = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
  var tag = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
  tag ? console.log(format(chalkTag(tag), msg)) : console.log(msg);
}
function info(msg) {
  console.log(format(chalk.bgBlue.black(' INFO '), msg));
}
function done(msg) {
  console.log(format(chalk.bgGreen.black(' DONE '), msg));
}
function warn(msg) {
  console.warn(format(chalk.bgYellow.black(' WARN '), chalk.yellow(msg)));
}
function error(msg) {
  console.error(format(chalk.bgRed(' ERROR '), chalk.red(msg)));
}
function printErrorAndExit(msg) {
  error(msg);
  process.exit(1);
}
function clearConsole(title) {
  if (process.stdout.isTTY) {
    var blank = '\n'.repeat(process.stdout.rows);
    console.log(blank);
    readline.cursorTo(process.stdout, 0, 0);
    readline.clearScreenDown(process.stdout);
    if (title) {
      console.log(title);
    }
  }
}
function step(name, msg) {
  if (msg) {
    console.log("\n".concat(chalk.gray(">>> ".concat(name, ":")), " ").concat(chalk.magenta.bold(msg)));
  } else {
    return function (msg) {
      return console.log("\n".concat(chalk.gray(">>> ".concat(name, ":")), " ").concat(chalk.magenta.bold(msg)));
    };
  }
}
export var logger = {
  log: log,
  info: info,
  done: done,
  warn: warn,
  error: error,
  printErrorAndExit: printErrorAndExit,
  step: step,
  clearConsole: clearConsole
};