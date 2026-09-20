import { prompts } from '@eljs/utils/cli'
import dayjs from 'dayjs'
import { execSync } from 'node:child_process'

import { definePlugin } from '../../define'
import { onCancel } from '../../utils'
import { author, email, getGitHref } from '../utils'

export default definePlugin(context => {
  context.modifyPrompts(async (memo, { questions }) => {
    if (!memo.$$isFirstTime) {
      const answers = await prompts(questions, {
        onCancel,
      })

      return {
        $$isFirstTime: true,
        ...memo,
        ...answers,
      }
    }

    return memo
  })

  context.modifyPrompts(memo => {
    let gitUrl = memo.gitUrl
    let gitHref: string

    if (!gitUrl || (!gitUrl.startsWith('git') && !gitUrl.startsWith('http'))) {
      gitUrl = '{{gitUrl}}'
      gitHref = '{{gitHref}}'
    } else {
      gitHref = getGitHref(gitUrl) || '{{gitHref}}'
    }

    const year = dayjs().format('YYYY')
    const date = dayjs().format('YYYY-MM-DD')
    const dateTime = dayjs().format('YYYY-MM-DD hh:mm:ss')

    let registry = 'https://registry.npmjs.org'

    if (!gitHref.includes('github')) {
      try {
        registry = execSync('npm config get registry').toString().trim()
      } catch (error) {
        // ...
      }
    }

    return {
      ...{
        author,
        email,
        gitUrl,
        gitHref,
        registry,
        year,
        date,
        dateTime,
      },
      // create-runner 的初值把内置键预置为空串占位，非空用户值才允许覆盖默认值
      ...pickBuiltInValues(memo, {
        author,
        email,
        gitUrl,
        gitHref,
        registry,
        year,
        date,
        dateTime,
      }),
      ...omitBuiltInKeys(memo, {
        author,
        email,
        gitUrl,
        gitHref,
        registry,
        year,
        date,
        dateTime,
      }),
    }
  })
})

/**
 * 收集 memo 中已由用户显式设置的内置键值
 *
 * @remarks
 * create-runner 传入的初值把内置键预置为空串占位；
 * 空串、null 与 undefined 均视为未设置，交由默认值兜底
 *
 * @param memo - 上一个钩子累积的输入
 * @param defaults - 当前钩子计算出的内置默认值
 * @returns 仅包含非空内置键的部分对象
 */
function pickBuiltInValues(
  memo: Record<string, unknown>,
  defaults: Record<string, unknown>,
): Record<string, unknown> {
  const picked: Record<string, unknown> = {}

  for (const key of Object.keys(defaults)) {
    const value = memo[key]
    if (value !== '' && value !== null && value !== undefined) {
      picked[key] = value
    }
  }

  return picked
}

/**
 * 透传 memo 中不属于内置键的其余属性
 *
 * @remarks
 * 内置键的取舍统一由 {@link pickBuiltInValues} 决定，
 * 其余键必须原样透传，避免丢失 preset 或用户插件追加的输入
 *
 * @param memo - 上一个钩子累积的输入
 * @param defaults - 当前钩子计算出的内置默认值
 * @returns 仅包含非内置键的部分对象
 */
function omitBuiltInKeys(
  memo: Record<string, unknown>,
  defaults: Record<string, unknown>,
): Record<string, unknown> {
  const rest: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(memo)) {
    if (!Object.hasOwn(defaults, key)) {
      rest[key] = value
    }
  }

  return rest
}
