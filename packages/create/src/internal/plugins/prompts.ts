import type { Api } from '@/types'
import { onCancel } from '@/utils'
import { prompts } from '@eljs/utils'
import dayjs from 'dayjs'
import { execSync } from 'node:child_process'

import { author, email, getGitHref } from '../utils'

export default (api: Api) => {
  api.modifyPrompts(async (memo, { questions }) => {
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
    let gitUrl = memo.gitUrl
    let gitHref = ''

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
      ...memo,
    }
  })
}
