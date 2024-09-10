import type { Api, ExtendPackageOpts } from '@/types'
import {
  chalk,
  install,
  isFunction,
  isPathExistsSync,
  logger,
  writeJSON,
} from '@eljs/utils'
import { join } from 'path'

export default (api: Api) => {
  api.registerMethod({
    name: 'extendPackage',
    async fn(opts: ExtendPackageOpts) {
      const pkgJSON = api.service.pkgJSON
      const toMerge = (isFunction(opts) ? await opts(pkgJSON) : opts) ?? {}
      api.service.pkgJSON = api.lodash.merge(api.service.pkgJSON, toMerge)
    },
  })

  api.register({
    key: 'onGenerateDone',
    stage: Number.NEGATIVE_INFINITY,
    async fn() {
      const pkgJSONPath = join(api.paths.target, 'package.json')
      let pkgJSON = api.service.pkgJSON

      if (isPathExistsSync(pkgJSONPath)) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const originPkgJSON = require(pkgJSONPath)
        pkgJSON = api.lodash.merge(originPkgJSON, pkgJSON)
      }

      if (Object.keys(pkgJSON).length === 0) {
        return
      }

      await writeJSON(
        pkgJSONPath,
        await api.formatJSON(pkgJSON as Record<any, any>),
      )
    },
  })

  api.register({
    key: 'onGenerateDone',
    stage: Infinity,
    fn() {
      api.utils.logger.done(
        `🎉  Created project ${chalk.cyanBright.bold(
          api.appData.projectName,
        )} successfully.`,
      )
    },
  })

  api.registerMethod({
    name: 'installDeps',
    fn() {
      const { packageManager = 'pnpm' } = api.appData

      logger.info('📦 Installing additional dependencies...')
      console.log()

      api.appData.installDeps = true
      install(api.paths.target, packageManager)
    },
  })
}
