import { chalk } from '@eljs/utils'
import { Api } from '../types'

export default (api: Api) => {
  ;[
    'onBeforeGenerateFiles',
    'onGenerateFiles',
    'onGenerateDone',
    'onPkgJSONChanged',
    'onGenerateSchema',
  ].forEach(name => {
    api.registerMethod({ name })
  })

  // Execute earliest, so that other onGenerateFiles can get it
  api.register({
    key: 'onGenerateFiles',
    async fn() {
      console.log(`${chalk.cyan('wait')} - Generate files ing ...`)
    },
    stage: Number.NEGATIVE_INFINITY,
  })

  api.register({
    key: 'onGenerateDone',
    async fn() {
      // 命令执行路径修改为, 项目生成路径, 终端执行时 需要该路径
      process.chdir(api.paths.absOutputPath)
    },
    stage: Number.NEGATIVE_INFINITY,
  })
}
