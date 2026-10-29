import prompts, { type Answers, type Choice, type PromptObject } from 'prompts'

function throwPromptCancelled(): never {
  throw new Error('Prompt was cancelled')
}

/**
 * 确认问询
 * @param message - 问询信息
 * @param preferNo - 是否默认 false
 * @param onCancel - 未提供取消回调时使用默认的抛错行为
 * @returns 用户确认返回 `true`，拒绝返回 `false`
 * @throws 用户取消时抛出错误
 */
export function confirm(
  message: string,
  preferNo?: boolean,
  onCancel?: undefined,
): Promise<boolean>
/**
 * 确认问询并使用自定义取消处理
 *
 * @param message - 问询信息
 * @param preferNo - 是否默认选择否
 * @param onCancel - 取消回调；省略时使用默认的抛错行为
 * @returns 确认结果；取消回调正常返回且没有答案时返回 `undefined`，回调抛错则拒绝
 */
export function confirm(
  message: string,
  preferNo: boolean | undefined,
  onCancel: prompts.Options['onCancel'],
): Promise<boolean | undefined>
export function confirm(
  message: string,
  preferNo?: boolean,
  onCancel?: prompts.Options['onCancel'],
): Promise<boolean | undefined> {
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
 * 带有明确返回值的选择项
 *
 * @typeParam T - 选择项的值类型
 */
export type SelectChoice<T> = Omit<Choice, 'value'> & { value: T }

/**
 * 选择问询
 * @typeParam T - 选择项的值类型，由静态选项或动态选项回调推导
 * @param message - 问询信息
 * @param choices - 问询选项
 * @param initial - 初始选项索引或计算索引的回调
 * @returns 选中项的值；缺省或值为 `undefined` 时由 prompts 返回选项索引
 * @throws 用户取消时抛出错误
 */
export function select<T>(
  message: string,
  choices:
    | SelectChoice<T>[]
    | prompts.PrevCaller<string, SelectChoice<T>[] | prompts.Falsy>,
  initial?: PromptObject['initial'],
): Promise<undefined extends T ? Exclude<T, undefined> | number : T>
/**
 * 选择问询，兼容值类型未明确声明或省略值的 prompts 选项
 *
 * @returns 选中项的值或缺省值对应的选项索引，调用方需自行缩小类型
 * @throws 用户取消时抛出错误
 */
export function select(
  message: string,
  choices: PromptObject['choices'],
  initial?: PromptObject['initial'],
): Promise<unknown>
export function select(
  message: string,
  choices: PromptObject['choices'],
  initial?: PromptObject['initial'],
): Promise<unknown> {
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
 * @remarks 仅在类型为 `undefined` 时默认使用文本问询，保留 `false`、`null` 等跳过设置
 * @throws 用户取消时抛出错误
 */
export function prompt<T extends string = string>(
  questions: PromptObject<T>[],
  initials?: Record<string, PromptObject<T>['initial']>,
): Promise<Answers<T>> {
  return prompts(prepareQuestions(questions, initials), {
    onCancel: throwPromptCancelled,
  })
}

/**
 * 为每轮问询创建独立对象，允许 prompts 解析动态字段而不改写调用方的问题定义
 */
function prepareQuestions<T extends string>(
  questions: PromptObject<T>[],
  initials?: Record<string, PromptObject<T>['initial']>,
): PromptObject<T>[] {
  return questions.map(question => {
    const copied = Object.assign({}, question)
    const name = (copied.name || '') as string

    copied.type = copied.type === undefined ? 'text' : copied.type

    if (initials && Object.hasOwn(initials, name)) {
      copied.initial = initials[name]
    }

    return copied
  })
}

/**
 * 循环问询
 * @remarks
 * 每轮输出答案的 JSON 摘要，实际解析为 `password`、`invisible` 类型或样式的问题，
 * 在摘要中将整个答案替换为固定的 `******`，包括动态类型、名称和格式化后的值
 * 其他问题的答案原样展示；脱敏不修改返回答案或下一轮初始值
 * @param questions - 问题列表
 * @param initials - 初始数据
 * @throws 任一轮问询被取消时抛出错误
 */
export function loopPrompt<T extends string = string>(
  questions: PromptObject<T>[],
  initials?: Record<string, PromptObject<T>['initial']>,
): Promise<Answers<T>> {
  const prepared = prepareQuestions(questions, initials)

  return prompts(prepared, { onCancel: throwPromptCancelled }).then(answers => {
    const sensitiveNames = new Set(
      prepared
        .filter(
          question =>
            question.type === 'password' ||
            question.type === 'invisible' ||
            question.style === 'password' ||
            question.style === 'invisible',
        )
        .map(question => question.name),
    )
    const summary = Object.fromEntries(
      Object.entries(answers).map(([name, value]) => [
        name,
        sensitiveNames.has(name as T) ? '******' : value,
      ]),
    )
    console.log()
    console.log('The information you entered is as follows:')
    console.log(JSON.stringify(summary, null, 2))
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
