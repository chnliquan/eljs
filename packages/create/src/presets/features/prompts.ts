import {
  camelCase,
  chalk,
  getGitUrl,
  getUserAccount,
  normalizeGitRepo,
  prompts,
} from '@eljs/utils'
import { execSync } from 'child_process'
import { writeFileSync } from 'fs'
import moment from 'moment'
import { basename, join } from 'path'
import { Api } from '../../types'

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
    const { name, email } = getUserAccount()
    const gitUrl = getGitUrl(api.target)
    const { href: gitHref = '' } = normalizeGitRepo(gitUrl)
    const year = moment().format('YYYY')
    const date = moment().format('YYYY-MM-DD')
    const dateTime = moment().format('YYYY-MM-DD hh:mm:ss')
    const dirname = basename(api.target)

    let registry: string

    if (gitHref.includes('github.com')) {
      registry = 'https://registry.npmjs.org'
    } else {
      registry =
        execSync('npm config get registry').toString().trim() ||
        'https://registry.npmjs.org'
    }

    const shortName = memo.name.replace(/^@[\s\S]+\//, '')

    return {
      author: name,
      email,
      gitUrl,
      gitHref,
      registry,
      year,
      date,
      dateTime,
      dirname,
      shortName,
      camelCaseName: camelCase(shortName),
      ...memo,
    }
  })

  api.onGenerateSchema(({ questions }) => {
    writeFileSync(
      join(api.cwd, 'schema.json'),
      JSON.stringify(
        questions.map(question => {
          const copied: Record<string, any> = { ...question }
          // 生成 Schema 时，mail 和 author 的配置项不需要默认值
          if (copied.name === 'mail' || copied.name === 'author') {
            delete copied.initial
          }

          copied.message = copied.message.replace(/\033\[[0-9;]*m/g, '')

          // 增加 isRequired
          if (copied.initial) {
            copied.isRequired = true
          }

          // initial 换成 value
          if (copied.type === 'select' && typeof copied.initial === 'number') {
            copied.initial = copied.choices?.[copied.initial]?.value ?? ''
          }

          return copied
        }),
      ),
    )
  })
}
