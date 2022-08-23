import {
  chalk,
  confirm,
  isArray,
  isDirectory,
  logger,
  prompts,
} from '@eljs/utils'
import assert from 'assert'
import { existsSync, readdirSync } from 'fs'
import path from 'path'
import { CreateOpts, TemplateInfo } from '../types'
import { Download } from './download'
import Generator from './generator'

export function objectToArray(obj: Record<string, any>, valueIsNumber = false) {
  return Object.keys(obj).map(key => {
    const title = obj[key]
    return {
      title,
      value: valueIsNumber ? Number(key) : key,
    }
  })
}

const TARGET_DIR_WHITE_LIST = ['.git', 'LICENSE']

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
   * 本地模板路径
   */
  private _localTemplatePath?: string

  public constructor(opts: CreateOpts) {
    assert(
      opts.template || opts.templateConfig || opts.templateInfo,
      `请传入\`templateConfig\`,\`templateInfo\`,\`template\`之一的配置项`,
    )
    this._opts = opts

    if (opts.cwd) {
      this._cwd = opts.cwd
    }

    this._ensureLocalTemplate(this._opts.template)
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

  public async run(projectName: string) {
    try {
      const targetDir = path.resolve(this.cwd, projectName)
      const override = await this._checkTargetDir(targetDir)

      if (!override) {
        return
      }

      const templatePath = await this._getTemplatePath()

      const generator = new Generator({
        isLocalTemplate: !!this._localTemplatePath,
        projectName,
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

  private async _ensureLocalTemplate(localTemplatePath?: string) {
    if (!localTemplatePath) {
      return
    }

    this._localTemplatePath = path.join(this._cwd, localTemplatePath)

    assert(
      existsSync(this._localTemplatePath),
      `传入的自定义模板 ${chalk.cyan(
        this._localTemplatePath,
      )} 不存在, 请检查输入`,
    )

    assert(
      isDirectory(this._localTemplatePath),
      `传入的自定义模板 ${chalk.cyan(
        this._localTemplatePath,
      )} 不是一个文件目录, 请检查输入`,
    )
  }

  private _checkTargetDir(targetDir: string) {
    if (this._opts.force) {
      return true
    }

    const files = readdirSync(targetDir).filter(
      file => !TARGET_DIR_WHITE_LIST.includes(file),
    )

    if (files.length) {
      logger.warn(`当前文件夹 ${chalk.bold(targetDir)} 存在如下文件:\n`)
      files.forEach(file => console.log(' - ' + file))
      console.log()
      return confirm(`确定要覆盖当前文件夹吗?`, true)
    }

    return true
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
    if (this._localTemplatePath) {
      return this._localTemplatePath
    }

    const templateInfo = await this._getTemplateInfo()
    const download = new Download(templateInfo as TemplateInfo)
    return download.download()
  }
}
