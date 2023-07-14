import prompts, { Choice, PromptObject } from 'prompts'
import readline from 'readline'
import { isNull } from './type'

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

export function confirm(
  message: string,
  preferNo?: boolean,
  onCancel?: prompts.Options['onCancel'],
): Promise<boolean> {
  onCancel = onCancel || (() => process.exit(1))

  return prompts(
    {
      type: 'confirm',
      message,
      name: 'confirm',
      initial: !preferNo,
    },
    {
      onCancel,
    },
  ).then(answers => {
    return answers.confirm
  })
}

export function select<T extends Choice>(
  message: string,
  choices: T[],
  initial?: PromptObject['initial'],
): Promise<string> {
  const fields: Array<PromptObject> = [
    {
      name: 'name',
      message,
      type: 'select',
      choices,
      initial,
    },
  ]

  return prompts(fields).then(answers => {
    return answers.name
  })
}
export function ask<T extends PromptObject, U extends Record<string, any>>(
  questions: T[],
  initials: U = Object.create(null),
): Promise<U> {
  questions = questions.map(question => {
    const copied = Object.assign({}, question)
    const name = (copied.name || '') as string

    copied.type = copied.type || isNull(copied.type) ? copied.type : 'text'

    if (initials[name]) {
      copied.initial = initials[name]
    }

    return copied
  })

  return prompts(questions) as Promise<U>
}

export function loopAsk<
  T extends PromptObject,
  U extends Record<string, any> = Record<string, any>,
>(questions: T[], initials: U = Object.create(null)): Promise<U> {
  return ask(questions, initials).then(answers => {
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
        return loopAsk(questions, answers)
      }
    })
  })
}
