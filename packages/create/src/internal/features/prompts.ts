import { chalk, prompts } from '@eljs/utils'
import { execSync } from 'child_process'
import dayjs from 'dayjs'
import { Api } from '../../types'
import { author, email, getGitHref, getGitUrl } from '../const'

export default (api: Api) => {
  api.modifyPrompts(async (memo, { questions }) => {
    // 仅第一次执行，并且如果当前执行生成 schema 不执行终端输入逻辑
    if (!memo.$$isFirstTime && !api.service.opts.isGenSchema) {
      const res = await prompts(questions, {
        onCancel() {
          console.log(`${chalk.magenta('event')} - 取消模板创建`)
          process.exit()
        },
      })

      return {
        $$isFirstTime: true,
        ...memo,
        ...res,
      }
    }

    return memo
  })

  api.modifyPrompts(memo => {
    const gitUrl = getGitUrl(api.target)
    const gitHref = getGitHref(api.target, memo.gitUrl)
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
