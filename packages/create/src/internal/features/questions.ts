import type { Api } from '@/types'
import path from 'path'
import { author, email, getGitUrl } from '../const'

export default async (api: Api) => {
  api.describe({
    key: 'defaultQuestions',
    enableBy() {
      return api.pluginConfig.defaultQuestions === true
    },
  })

  api.register({
    key: 'addQuestions',
    stage: Number.NEGATIVE_INFINITY,
    async fn() {
      return [
        {
          name: 'name',
          type: 'text',
          message: `项目名称`,
          initial: api.args.projectName || path.basename(api.target),
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
          initial: getGitUrl(api.target),
        },
      ]
    },
  })

  api.register({
    key: 'addQuestions',
    stage: Number.POSITIVE_INFINITY,
    async fn() {
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
  })
}
