import prompts, { Choice, PromptObject } from 'prompts'
import { isNull } from '../type'

/**
 * 确认问询
 * @param message 闻讯信息
 * @param preferNo 是否默认 false
 * @param onCancel 取消回调函数
 */
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

/**
 * 选择问询
 * @param message 问询信息
 * @param choices 问询选项
 * @param initial 问询初始化数据
 */
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

/**
 * 问询
 * @param questions 问询问题列表
 * @param initials 问询初始化数据
 */
export function prompt<T extends PromptObject, U extends Record<string, any>>(
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

/**
 * 循环问询
 * @param questions 问询问题列表
 * @param initials 问询初始化数据
 */
export function loopPrompt<
  T extends PromptObject,
  U extends Record<string, any> = Record<string, any>,
>(questions: T[], initials: U = Object.create(null)): Promise<U> {
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
