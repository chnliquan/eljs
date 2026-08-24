import prompts, { type Answers, type PromptObject } from 'prompts'

import { isNull } from '../guards'

function throwPromptCancelled(): never {
  throw new Error('Prompt was cancelled')
}

/**
 * 确认问询
 * @param message - 问询信息
 * @param preferNo - 是否默认 false
 * @param onCancel - 取消回调函数
 * @throws 用户取消且调用方没有提供取消回调时抛出错误
 */
export function confirm(
  message: string,
  preferNo?: boolean,
  onCancel?: prompts.Options['onCancel'],
): Promise<boolean> {
  onCancel ??= throwPromptCancelled

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

/**
 * 选择问询
 * @param message - 问询信息
 * @param choices - 问询选项
 * @param initial - 初始数据
 * @throws 用户取消时抛出错误
 */
export function select<T extends string = string>(
  message: string,
  choices: PromptObject['choices'],
  initial?: PromptObject<T>['initial'],
): Promise<string> {
  const questions: PromptObject[] = [
    {
      name: 'name',
      message,
      type: 'select',
      choices,
      initial,
    },
  ]

  return prompts(questions, { onCancel: throwPromptCancelled }).then(
    answers => {
      return answers.name
    },
  )
}

/**
 * 问询
 * @param questions - 问题列表
 * @param initials - 初始数据
 * @throws 用户取消时抛出错误
 */
export function prompt<T extends string = string>(
  questions: PromptObject<T>[],
  initials?: Record<string, PromptObject<T>['initial']>,
): Promise<Answers<T>> {
  questions = questions.map(question => {
    const copied = Object.assign({}, question)
    const name = (copied.name || '') as string

    copied.type = copied.type || isNull(copied.type) ? copied.type : 'text'

    if (initials && Object.hasOwn(initials, name)) {
      copied.initial = initials[name]
    }

    return copied
  })

  return prompts(questions, { onCancel: throwPromptCancelled })
}

/**
 * 循环问询
 * @param questions - 问题列表
 * @param initials - 初始数据
 * @throws 任一轮问询被取消时抛出错误
 */
export function loopPrompt<T extends string = string>(
  questions: PromptObject<T>[],
  initials?: Record<string, PromptObject<T>['initial']>,
): Promise<Answers<T>> {
  return prompt(questions, initials).then(answers => {
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
        return loopPrompt(questions, answers)
      }
    })
  })
}
