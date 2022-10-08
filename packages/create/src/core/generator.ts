import { Env } from '@eljs/service'
import { chalk, logger, tryPaths } from '@eljs/utils'
import assert from 'assert'
import { join } from 'path'
import { GenerateService } from './service'

export interface GeneratorOptions {
  targetDir: string
  projectName: string
  cwd: string
  args?: Record<string, any>
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

      // 检查生成配置否存在
      const generatorFile = tryPaths([
        join(templatePath, 'generators/index.ts'),
        join(templatePath, 'generators/index.js'),
      ])

      const service = new GenerateService({
        cwd,
        plugins: generatorFile ? [require.resolve(generatorFile)] : [],
        isGenSchema,
        env: process.env.NODE_ENV as Env,
      })

      await service.run({
        target: targetDir,
        args: {
          ...(this._opts.args || {}),
          projectName,
        },
      })
    }
  }
}
