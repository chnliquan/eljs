import { Create, TemplateInfo } from '@eljs/create'
import { prompts } from '@eljs/utils'
import assert from 'assert'
import { CreateTemplateOpts } from './types'

export function objectToArray(
  obj: Record<string, unknown>,
  valueIsNumber = false,
) {
  return Object.keys(obj).map(key => {
    const title = obj[key] as string
    return {
      title,
      value: valueIsNumber ? Number(key) : key,
    }
  })
}

export class CreateTemplate {
  /**
   * 构造函数配置项
   */
  private _opts: CreateTemplateOpts
  /**
   * 当前路径
   */
  private _cwd: string = process.cwd()

  public constructor(opts: CreateTemplateOpts) {
    this._opts = opts

    if (opts.cwd) {
      this._cwd = opts.cwd
    }
  }

  public get cwd() {
    return this._cwd
  }

  public get templateConfig() {
    return this._opts.templateConfig
  }

  public async run(projectName: string) {
    const templateInfo = await this._getTemplateInfo()

    const create = new Create({
      cwd: this.cwd,
      templateInfo,
    })
    await create.run(projectName)
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
    if (!this.templateConfig) {
      return
    }

    const { appType, templates } = this.templateConfig
    let appTypeAnswer = this._opts.appType as string
    let appNameAnswer = this._opts.appName as string

    if (!this._opts.appType || !(this._opts.appType in appType)) {
      const answer = await prompts({
        type: 'select',
        name: 'appType',
        message: '请选择场景',
        choices: objectToArray(appType),
      })
      appTypeAnswer = answer.appType
    }

    if (
      !this._opts.appName ||
      !(this._opts.appName in templates[appTypeAnswer])
    ) {
      const answer = await prompts({
        type: 'select',
        name: 'appName',
        message: '请选择模板',
        choices: this._formatTemplate(templates[appTypeAnswer]),
      })
      appNameAnswer = answer.appName
    }

    assert(appTypeAnswer, '请选择场景')
    assert(appNameAnswer, '请选择模板')

    const templateInfo =
      this.templateConfig.templates[appTypeAnswer][appNameAnswer]

    assert(
      templateInfo,
      `当前选择的场景：${appTypeAnswer}，模板Id：${appNameAnswer} 未找到对应的模板配置`,
    )

    return templateInfo
  }
}
