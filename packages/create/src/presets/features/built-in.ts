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
      const pkg = api.service.pkg
      const toMerge = (isFunction(opts) ? await opts(pkg) : opts) ?? {}
      api.service.pkg = deepMerge(api.service.pkg, toMerge)
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
      let pkg = api.service.pkg
      if (existsSync(pkgJSONPath)) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const originPkg = require(pkgJSONPath)
        pkg = deepMerge(originPkg, pkg)
      }

      if (Object.keys(pkg).length === 0) {
        logger.warn('pkg 为空对象, 不生成 package.json')
        return
      }

      writeFileSync(pkgJSONPath, formatPkgJSON(JSON.stringify(pkg, null, 2)))

      logger.info('Generate package.json')
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