import chalk from 'chalk'
import ora from 'ora'

const spinner = ora()
let lastMsg = null as {
  symbol: string
  text: string
} | null
let isPaused = false

export function logWithSpinner(msg: string, symbol?: string) {
  if (!symbol) {
    symbol = chalk.green('✔')
  }

  if (lastMsg) {
    spinner.stopAndPersist({
      symbol: lastMsg.symbol,
      text: lastMsg.text,
    })
  }

  spinner.text = ' ' + msg
  lastMsg = {
    symbol: symbol + ' ',
    text: msg,
  }
  spinner.start()
}

export function stopSpinner(persist?: boolean) {
  if (!spinner.isSpinning) {
    return
  }

  if (lastMsg && persist !== false) {
    spinner.stopAndPersist({
      symbol: lastMsg.symbol,
      text: lastMsg.text,
    })
  } else {
    spinner.stop()
  }

  lastMsg = null
}

export function pauseSpinner() {
  if (spinner.isSpinning) {
    spinner.stop()
    isPaused = true
  }
}

export function resumeSpinner() {
  if (isPaused) {
    spinner.start()
    isPaused = false
  }
}

export function failSpinner(text: string) {
  spinner.fail(text)
}
