import { chalk, logger, removeSync, tryPaths } from '@eljs/utils'
import assert from 'assert'
import { join } from 'path'
import { getPresetsAndPlugins, isGenConfigExist } from './config'
import { GenerateService } from './service'

export interface GeneratorOptions {
  targetDir: string
  projectName: string
  cwd: string
  isLocalTemplate?: boolean
  isGenSchema?: boolean
}

export default class Generator {
  private _opts: GeneratorOptions

  public constructor(opts: GeneratorOptions) {
    this._opts = opts
  }

  public async create(templatePath?: string) {
    assert(templatePath, 'templatePath 不允许为空')
    const { isLocalTemplate, targetDir, projectName, cwd, isGenSchema } =
      this._opts

    if (templatePath) {
      if (isLocalTemplate) {
        logger.info(`启用本地模板生成，模板路径：${chalk.yellow(templatePath)}`)
      }

      let presets: string[] = []
      let plugins: string[] = []

      if (isGenConfigExist(cwd)) {
        const presetsAndPlugins = getPresetsAndPlugins(cwd)
        presets = presetsAndPlugins.presets
        plugins = presetsAndPlugins.plugins
      } else {
        // 检查生成配置否存在
        const generatorFile = tryPaths([
          join(templatePath, 'generators/index.ts'),
          join(templatePath, 'generators/index.js'),
        ])

        assert(
          generatorFile,
          `创建项目失败, 模板配置必须包含 ${chalk.red('generators/index.ts')}`,
        )

        plugins = [require.resolve(generatorFile)]
      }

      const gen = new GenerateService({
        cwd,
        presets,
        plugins,
        isGenSchema,
      })

      await gen.run({
        target: targetDir,
        args: {
          projectName,
        },
      })

      this._removeTemplate(templatePath)
    }
  }

  private _removeTemplate(templatePath: string) {
    if (!this._opts.isLocalTemplate) {
      removeSync(templatePath)
    }
  }
}