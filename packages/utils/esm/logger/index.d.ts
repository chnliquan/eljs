declare function log(msg?: string, tag?: string): void
declare function info(msg: string): void
declare function done(msg: string): void
declare function warn(msg: string): void
declare function error(msg: string): void
declare function printErrorAndExit(msg: string): void
declare function clearConsole(title: string): void
declare function step(name: string): (msg: string) => void
declare function step(name: string, msg: string): void
export declare const logger: {
  log: typeof log
  info: typeof info
  done: typeof done
  warn: typeof warn
  error: typeof error
  printErrorAndExit: typeof printErrorAndExit
  step: typeof step
  clearConsole: typeof clearConsole
}
export {}
//# sourceMappingURL=index.d.ts.map
