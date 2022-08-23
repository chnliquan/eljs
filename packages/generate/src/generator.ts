import { chalk, logger, removeSync, tryPaths } from '@eljs/utils'
import assert from 'assert'
import { join } from 'path'
import { GenerateService } from './service'

export interface GeneratorOptions {
  isCustomTemplate: boolean
  targetDir: string
  projectName: string
  cwd: string
  isGenSchema?: boolean
}

export default class Generator {
  private _opts: GeneratorOptions

  public constructor(opts: GeneratorOptions) {
    this._opts = opts
  }

  public async create(templatePath?: string) {
    assert(templatePath, 'templatePath 不允许为空')
    const { isCustomTemplate, targetDir, projectName, cwd, isGenSchema } =
      this._opts

    if (templatePath) {
      if (isCustomTemplate) {
        logger.info(`启用本地模板生成，模板路径：${chalk.yellow(templatePath)}`)
      }

      // 检查生成配置否存在
      const generatorFile = tryPaths([
        join(templatePath, 'generators/index.ts'),
        join(templatePath, 'generators/index.js'),
      ])

      assert(
        generatorFile,
        `创建项目失败, 模板配置必须包含 ${chalk.red('generators/index.ts')}`,
      )

      const gen = new GenerateService({
        cwd,
        generatorFile,
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
    const { isCustomTemplate } = this._opts
    if (!isCustomTemplate) {
      removeSync(templatePath)
    }
  }
}
