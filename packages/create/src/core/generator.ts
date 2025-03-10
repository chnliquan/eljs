import { chalk, logger, tryPaths } from '@eljs/utils'
import assert from 'node:assert'
import { join } from 'node:path'

import { Runner } from './runner'

/**
 * 生成器构造函数参数
 */
export interface GeneratorOptions {
  /**
   * 目标路径
   */
  targetDir: string
  /**
   * 项目名称
   */
  projectName: string
  /**
   * 是否是本地
   */
  isLocal?: boolean
}

/**
 * 生成器类
 */
export class Generator {
  /**
   * 构造函数参数
   */
  public options: GeneratorOptions

  public constructor(options: GeneratorOptions) {
    this.options = options
  }

  public async generate(templatePath?: string) {
    assert(templatePath, 'templatePath 不允许为空')
    const { isLocal, targetDir, projectName } = this.options

    if (templatePath) {
      if (isLocal) {
        logger.info(`启用本地模板生成，模板路径：${chalk.yellow(templatePath)}`)
      }

      // 检查生成配置否存在
      const generatorFile = await tryPaths([
        join(templatePath, 'generators/index.ts'),
        join(templatePath, 'generators/index.js'),
      ])

      const runner = new Runner({
        cwd: templatePath,
        plugins: generatorFile ? [require.resolve(generatorFile)] : [],
      })

      assert(
        runner.userConfig?.presets?.length ||
          runner.userConfig?.plugins?.length ||
          generatorFile,
        `创建项目失败，必须包含配置文件 ${chalk.red(
          '.create.ts/create.js',
        )} 或者 ${chalk.red('generators/index.ts')}`,
      )

      await runner.run(targetDir, projectName)
    }
  }
}
