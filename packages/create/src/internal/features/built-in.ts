import {
  chalk,
  deepMerge,
  installWithNpmClient,
  isFunction,
  logger,
} from '@eljs/utils'
import { existsSync, writeFileSync } from 'fs'
import { join } from 'path'
import prettier from 'prettier'
import sortPackageJson from 'sort-package-json'
import { Api, ExtendPackageOpts } from '../../types'

function formatPkgJSON(pkg: string) {
  const sortPkg = sortPackageJson(pkg)

  // function getPrettierConfig() {
  //   const prettierPath = tryPaths([
  //     `${absOutputPath}/prettier.config.js`,
  //     `${absOutputPath}/.prettierrc.js`,
  //     `${absOutputPath}/.prettierrc`,
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

  return prettier.format(sortPkg, {
    tabWidth: 2,
    parser: 'json',
  })
}

export default (api: Api) => {
  // #region  更新package.json 的内容
  api.registerMethod({
    name: 'extendPackage',
    async fn(opts: ExtendPackageOpts) {
      const pkgJSON = api.service.pkgJSON
      const toMerge = (isFunction(opts) ? await opts(pkgJSON) : opts) ?? {}
      api.service.pkgJSON = deepMerge(api.service.pkgJSON, toMerge)
    },
  })

  api.register({
    key: 'onGenerateFiles',
    stage: Number.NEGATIVE_INFINITY,
    async fn() {
      console.log(`${chalk.cyan('wait')} - Generate files ing ...`)
    },
  })

  api.register({
    key: 'onGenerateDone',
    stage: Number.NEGATIVE_INFINITY,
    fn() {
      const pkgJSONPath = join(api.paths.absOutputPath, 'package.json')
      let pkgJSON = api.service.pkgJSON

      if (existsSync(pkgJSONPath)) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const originPkgJSON = require(pkgJSONPath)
        pkgJSON = deepMerge(originPkgJSON, pkgJSON)
      }

      if (Object.keys(pkgJSON).length === 0) {
        logger.warn('pkgJSON 为空对象, 跳过 package.json 生成')
        return
      }

      writeFileSync(
        pkgJSONPath,
        formatPkgJSON(JSON.stringify(pkgJSON, null, 2)),
      )

      logger.info('Generate package.json')
    },
  })

  api.register({
    key: 'onGenerateDone',
    stage: Infinity,
    fn() {
      api.utils.logger.done(
        `🎉  Created project ${chalk.green.bold(
          api.appData.projectName,
        )} successfully.`,
      )
    },
  })

  api.registerMethod({
    name: 'installDeps',
    fn() {
      const { npmClient = 'pnpm' } = api.appData

      logger.info('📦 Installing additional dependencies...')
      console.log()

      api.appData.installDeps = true

      installWithNpmClient({
        npmClient,
        cwd: api.paths.absOutputPath,
      })
    },
  })
}
