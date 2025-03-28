import { Create } from '@eljs/create'
import { prompts } from '@eljs/utils'
import assert from 'node:assert'

import { defaultConfig, type RemoteTemplate } from './config'
import { objectToArray, onCancel } from './utils'

/**
 * 构造函数参数
 */
export interface CreateTemplateOptions {
  /**
   * 当前工作目录
   */
  cwd?: string
  /**
   * 应用场景
   */
  scene?: string
  /**
   * 应用模版
   */
  template?: string
  /**
   * 是否覆盖已存在文件夹
   */
  force?: boolean
  /**
   * 是否合并已存在文件夹
   */
  merge?: boolean
}

export class CreateTemplate {
  /**
   * 构造函数参数
   */
  public constructorOptions: CreateTemplateOptions
  /**
   * 当前工作目录
   */
  public cwd: string

  public constructor(options: CreateTemplateOptions) {
    this.constructorOptions = options
    this.cwd = options.cwd || process.cwd()
  }

  public async run(projectName: string) {
    const template = await this._getTemplate()
    const create = new Create({
      ...this.constructorOptions,
      cwd: this.cwd,
      template,
    })
    await create.run(projectName)
  }

  private async _getTemplate() {
    const { scenes, templates } = defaultConfig
    let sceneAnswer = this.constructorOptions.scene as string
    let templateAnswer = this.constructorOptions.template as string

    if (
      !this.constructorOptions.scene ||
      !(this.constructorOptions.scene in scenes)
    ) {
      const answer = await prompts(
        {
          type: 'select',
          name: 'scene',
          message: 'Select the application scene',
          choices: objectToArray(scenes),
        },
        {
          onCancel,
        },
      )
      sceneAnswer = answer.scene
    }

    if (
      !this.constructorOptions.template ||
      !(this.constructorOptions.template in templates[sceneAnswer])
    ) {
      const answer = await prompts(
        {
          type: 'select',
          name: 'template',
          message: 'Select the application template',
          choices: this._formatTemplate(templates[sceneAnswer]),
        },
        {
          onCancel,
        },
      )
      templateAnswer = answer.template
    }

    assert(sceneAnswer, 'Excepted the application scene.')
    assert(templateAnswer, 'Excepted the application template.')

    const template = defaultConfig.templates[sceneAnswer][templateAnswer]

    assert(
      template,
      `The selected scene \`${sceneAnswer}\` and template \`${templateAnswer}\` do not corresponding any configuration.`,
    )

    return template
  }

  private _formatTemplate(template: Record<string, RemoteTemplate>) {
    return Object.keys(template).map(key => {
      const title = template[key].description
      return {
        title,
        value: key,
      }
    })
  }
}
