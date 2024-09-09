import {
  chalk,
  install,
  isFunction,
  isPathExistsSync,
  logger,
} from '@eljs/utils'
import { writeFileSync } from 'fs'
import { join } from 'path'
import prettier from 'prettier'
import type { Api, ExtendPackageOpts } from '../../types'

async function formatPkgJSON(pkgJSONPath: string) {
  // esm 语法需要使用动态 import 引入
  const { default: sortPackageJson } = await import('sort-package-json')
  // function getPrettierConfig() {
  //   const prettierPath = tryPaths([
  //     `${target}/prettier.config.js`,
  //     `${target}/.prettierrc.js`,
  //     `${target}/.prettierrc`,
  //   ])

  //   if (!prettierPath) {
  //     return {
  //       tabWidth: 2,
  //       parser: 'json',
  //     }
  //   }

  //   try {
  //     // eslint-disable-next-line @typescript-eslint/no-var-requires
  //     const configOrConfigGen = require(prettierPath)

  //     if (typeof configOrConfigGen === 'function') {
  //       return configOrConfigGen.call(null)
  //     }

  //     return configOrConfigGen
  //   } catch (e) {
  //     return readJSONSync(prettierPath)
  //   }
  // }

  return prettier.format(sortPackageJson(pkgJSONPath), {
    tabWidth: 2,
    parser: 'json',
  })
}

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

      writeFileSync(
        pkgJSONPath,
        await formatPkgJSON(JSON.stringify(pkgJSON, null, 2)),
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
