import { ProjectCreator } from '@eljs/create'
import { prompts } from '@eljs/utils'
import assert from 'node:assert'

import { defaultConfig, type RemoteTemplate } from './config'
import { objectToArray, onCancel } from './utils'

/**
 * 构造函数选项
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
  /**
   * 是否允许模板依赖安装脚本
   */
  allowTemplateScripts?: boolean
}

/**
 * 通过场景和模版选择创建项目
 */
export class CreateTemplate {
  /**
   * 构造函数选项
   */
  public constructorOptions: CreateTemplateOptions
  /**
   * 当前工作目录
   */
  public cwd: string

  /**
   * 创建模版选择器
   *
   * @param options - 工作目录和默认场景、模版
   */
  public constructor(options: CreateTemplateOptions) {
    this.constructorOptions = options
    this.cwd = options.cwd || process.cwd()
  }

  /**
   * 解析模版并运行项目创建流程
   *
   * @param projectName - 项目名称
   * @returns 创建流程结束后兑现的 Promise
   */
  public async run(projectName: string): Promise<void> {
    const template = await this._getTemplate()
    const create = new ProjectCreator({
      ...this.constructorOptions,
      cwd: this.cwd,
      template,
    })
    await create.run(projectName)
  }

  /**
   * 解析交互选择后的远程模版
   *
   * @returns 远程模版配置
   */
  private async _getTemplate(): Promise<RemoteTemplate> {
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

  /**
   * 将模版映射转换为 prompts 选项
   *
   * @param template - 模版配置映射
   * @returns prompts 选项集合
   */
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
