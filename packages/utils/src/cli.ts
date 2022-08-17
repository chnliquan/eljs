/* eslint-disable @typescript-eslint/no-explicit-any */
import inquirer from 'inquirer'
import ora from 'ora'
import readline from 'readline'
import { SpinOptions } from './types'

export { SpinOptions }

export function pause(message?: string): Promise<void> {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    if (!message) {
      message = 'Press ENTER key to continue...'
    }

    rl.question(message, () => {
      resolve()
      rl.close()
    })
  })
}

export function confirm(message: string, preferNo?: boolean): Promise<boolean> {
  return inquirer
    .prompt([
      {
        type: 'confirm',
        message,
        name: 'confirm',
        default: !preferNo,
      },
    ])
    .then(answers => {
      return answers.confirm
    })
}

export interface Choice {
  name: string
  value: unknown
}

export function select<T = string, U extends Choice = Choice>(
  message: string,
  choices: U[],
  defaultValue?: string,
): Promise<T> {
  const fields = [
    {
      name: 'name',
      message,
      type: 'list',
      choices,
      default: defaultValue,
    },
  ]
  return inquirer.prompt(fields).then(answers => {
    return answers.name
  })
}

export function ask<T extends Record<string, any> = Record<string, any>>(
  fields: Record<string, any>[],
  defaults: Partial<T> = Object.create(null),
): Promise<T> {
  return inquirer.prompt(
    fields.map(field => {
      const copied = Object.assign({}, field)
      copied.type = copied.type || 'input'
      const name = (copied.name || '') as string

      if (defaults[name]) {
        copied.default = defaults[name]
      }
      return copied
    }),
  )
}

export function loopAsk<T extends Record<string, any> = Record<string, any>>(
  fields: Record<string, any>[],
  defaults: Partial<T> = Object.create(null),
): Promise<T> {
  return ask(fields, defaults).then((answers: any) => {
    console.log()
    console.log('The information you entered is as follows:')
    console.log(JSON.stringify(answers, null, 2))
    console.log()

    return confirm(
      'If the information is correct, press Y to confirm; if you need to re-enter, press N',
    ).then(isOK => {
      if (isOK) {
        return answers
      } else {
        return loopAsk(fields, answers)
      }
    })
  })
}

export async function spin<T>(
  text: string,
  handler: (...args: any[]) => Promise<T>,
  options?: SpinOptions,
): Promise<T> {
  const spinner = ora(text).start()
  const opts = Object.assign(
    {
      successText: text,
      failText: text,
      args: [],
    },
    options,
  )

  try {
    const res = await handler(...opts.args)
    spinner.succeed(opts.successText)
    return res
  } catch (error) {
    spinner.fail(opts.failText)
    throw new Error(`Failed spin ${handler}, the error is ${error}`)
  }
}
