import path from 'node:path'

import { definePlugin } from '../../define'

import { author, email, getGitUrl } from '../utils'

export default definePlugin(async context => {
  context.describe({
    key: 'defaultQuestions',
    enable() {
      return Boolean(context.config.defaultQuestions)
    },
  })

  context.addQuestions(
    () => {
      return [
        {
          name: 'name',
          type: 'text',
          message: `项目名称`,
          initial:
            context.appData.projectName || path.basename(context.paths.target),
        },
        {
          name: 'description',
          type: 'text',
          message: `项目介绍`,
        },
        {
          name: 'author',
          type: 'text',
          message: `Git 用户名`,
          initial: author,
        },
        {
          name: 'email',
          type: 'text',
          message: `Git 邮箱`,
          initial: email,
        },
        {
          name: 'gitUrl',
          type: 'text',
          message: `Git 地址`,
          initial: getGitUrl(context.paths.target),
        },
      ]
    },
    {
      stage: Number.NEGATIVE_INFINITY,
    },
  )

  context.addQuestions(
    () => {
      return [
        {
          type: 'select',
          name: 'packageManager',
          message: '包管理器',
          choices: [
            { title: 'npm', value: 'npm' },
            { title: 'yarn', value: 'yarn' },
            { title: 'pnpm', value: 'pnpm' },
          ],
          initial: 2,
        },
      ]
    },
    {
      stage: Number.POSITIVE_INFINITY,
    },
  )
})
