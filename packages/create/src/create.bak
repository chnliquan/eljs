import {
  chalk,
  getNpmInfo,
  isArray,
  isDirectory,
  logger,
  pkgNameAnalysis,
  prompts,
  removeSync,
} from '@eljs/utils'
import assert from 'assert'
import { existsSync } from 'fs'
import path from 'path'
import { Download } from './download'
import Generator from './generator'
import { CreateOpts, TemplateConfig, TemplateInfo, TemplateType } from './types'

export function objectToArray(obj: Record<string, any>, valueIsNumber = false) {
  return Object.keys(obj).map(key => {
    const title = obj[key]
    return {
      title,
      value: valueIsNumber ? Number(key) : key,
    }
  })
}

export class Create {
  /**
   * 构造函数配置项
   */
  private _opts: CreateOpts
  /**
   * 当前路径
   */
  private _cwd: string = process.cwd()
  /**
   * 模版配置
   */
  private _templateConfig?: TemplateConfig
  /**
   * 是否是自定义模板
   */
  private _isCustomTemplate: boolean
  /**
   * 自定义模板路径
   */
  private _customTemplatePath?: string
  /**
   * 自定义模板类型
   */
  private _customTemplateType?: TemplateType

  public constructor(opts: CreateOpts) {
    assert(
      opts.template || opts.templateConfig || opts.templateInfo,
      `请传入\`templateConfig\`,\`templateInfo\`,\`templateConfig\`之一的配置项`,
    )
    this._opts = opts

    if (opts.cwd) {
      this._cwd = opts.cwd
    }

    this._isCustomTemplate = !!this._opts.template
  }

  public get cwd() {
    return this._cwd
  }

  public get templateConfig() {
    return this._opts.templateConfig
  }

  public get templateInfo() {
    return this._opts.templateInfo
  }

  public async run(projectName = '.') {
    try {
      await this._initTemplateInfo()
      await this._validateTemplate()

      // 是否是当前路径
      const isCurrent = projectName === '.'
      const name = isCurrent ? path.relative('../', this.cwd) : projectName
      const targetDir = path.resolve(this.cwd, projectName)

      if (existsSync(targetDir)) {
        if (this._opts.force) {
          removeSync(targetDir)
        } else if (isCurrent) {
          const answers = await prompts({
            type: 'toggle',
            name: 'ok',
            message: `确认在当前目录 ${chalk.cyan(targetDir)} 中生成项目吗?`,
            initial: true,
            active: 'yes',
            inactive: 'no',
          })

          if (!answers.ok) {
            return
          }
        } else {
          const answers = await prompts({
            name: 'action',
            type: 'select',
            message: `目录【${chalk.cyan(
              targetDir,
            )}】已经存在, 请选择后续操作:`,
            choices: [
              { title: 'Overwrite', value: 'overwrite', description: '覆盖' },
              { title: 'Merge', value: 'merge', description: '合并' },
              { title: 'Cancel', value: false, description: '取消创建' },
            ],
          })

          if (!answers.action) {
            return
          }

          if (answers.action === 'overwrite') {
            console.log(`\nRemoving ${chalk.cyan(targetDir)}...`)
            removeSync(targetDir)
          }
        }
      }

      const templatePath = await this._getTemplatePath()

      const generator = new Generator({
        isCustomTemplate: this._isCustomTemplate,
        projectName: name,
        targetDir,
        cwd: this.cwd,
        isGenSchema: this._opts.schema,
      })

      await generator.create(templatePath)
    } catch (err: any) {
      logger.error(err.message)
      process.exit(1)
    }
  }

  private async _getTemplateType(name: string) {
    try {
      const [pkgName, pkgVersion] = pkgNameAnalysis(name)
      await getNpmInfo(pkgName, {
        version: pkgVersion,
      })
      return 'npm'
    } catch (err) {
      return 'local'
    }
  }

  private async _initTemplateInfo() {
    this._customTemplateType = await this._getTemplateType(
      this._opts.template || '',
    )
    if (this._opts.template && this._customTemplateType === 'local') {
      this._customTemplatePath = path.join(this._cwd, this._opts.template)
    }
  }

  private async _validateTemplate() {
    if (this._isCustomTemplate && this._customTemplatePath) {
      assert(
        existsSync(this._customTemplatePath),
        `传入的自定义模板 ${chalk.cyan(
          this._customTemplatePath,
        )} 不存在, 请检查输入`,
      )

      assert(
        isDirectory(this._customTemplatePath),
        `传入的自定义模板 ${chalk.cyan(
          this._customTemplatePath,
        )} 不是一个文件目录, 请检查输入`,
      )
    }
  }

  private _formatTemplate(template: Record<string, TemplateInfo>) {
    return Object.keys(template).map(key => {
      const title = template[key].description
      return {
        title,
        value: key,
      }
    })
  }

  private async _getTemplateInfo() {
    if (this._isCustomTemplate && this._customTemplateType === 'npm') {
      return {
        type: this._customTemplateType,
        description: '',
        value: this._opts.template || '',
      }
    }

    if (this.templateInfo) {
      return this.templateInfo
    }

    if (isArray(this.templateConfig)) {
      const { templateId } = await prompts(
        {
          type: 'select',
          name: 'templateId',
          message: '选择模板',
          choices: this.templateConfig.map((templateInfo, index) => ({
            title: templateInfo.description,
            value: index,
          })),
        },
        {
          onCancel() {
            throw new Error(chalk.red('✖') + ' Operation cancelled')
          },
        },
      )
      return this.templateConfig[templateId]
    } else if (this.templateConfig) {
      const { appType, templates } = this.templateConfig
      const choices = objectToArray(appType)

      const { appType: selectedAppType, templateId } = await prompts(
        [
          {
            type: 'select',
            name: 'appType',
            message: '请选择场景',
            choices,
          },
          {
            type: 'select',
            name: 'templateId',
            message: '请选择模板',
            choices: (prev: string) => this._formatTemplate(templates[prev]),
          },
        ],
        {
          onCancel() {
            throw new Error(chalk.red('✖') + ' Operation cancelled')
          },
        },
      )

      assert(selectedAppType, '请选择场景')
      assert(templateId, '请选择模板')

      const templateInfo =
        this.templateConfig.templates[selectedAppType][templateId]

      assert(
        templateInfo,
        `当前选择的场景：${appType}，模板Id：${templateId} 未找到对应的模板配置`,
      )

      return templateInfo
    }
  }

  private async _getTemplatePath() {
    if (this._isCustomTemplate && this._customTemplateType === 'local') {
      return this._customTemplatePath
    }

    const templateInfo = await this._getTemplateInfo()
    const download = new Download(templateInfo as TemplateInfo)
    return download.download()
  }
}
