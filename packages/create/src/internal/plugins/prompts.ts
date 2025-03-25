import type { Api } from '@/types'
import { onCancel } from '@/utils'
import { prompts } from '@eljs/utils'
import dayjs from 'dayjs'
import { execSync } from 'node:child_process'

import { author, email, getGitHref, getGitUrl } from '../utils'

export default (api: Api) => {
  api.modifyPrompts(async (memo, { questions }) => {
    // 仅第一次执行，并且如果当前执行生成 schema 不执行终端输入逻辑
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

  api.modifyPrompts(memo => {
    const gitUrl = memo.gitUrl ?? getGitUrl(api.paths.target) ?? '${gitUrl}'
    const gitHref = getGitHref(gitUrl)
    const year = dayjs().format('YYYY')
    const date = dayjs().format('YYYY-MM-DD')
    const dateTime = dayjs().format('YYYY-MM-DD hh:mm:ss')

    let registry: string

    if (gitHref.includes('github.com')) {
      registry = 'https://registry.npmjs.org'
    } else {
      registry =
        execSync('npm config get registry').toString().trim() ||
        'https://registry.npmjs.org'
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
      ...memo,
    }
  })
}
