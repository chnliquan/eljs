import { AppError, ProjectCreator, type Config } from '@eljs/create'
import { prompts } from '@eljs/utils/cli'

import {
  defaultConfig,
  type RemoteTemplate,
  type TemplateConfig,
} from './config'
import { onCancel } from './utils'

/**
 * 构造函数选项
 */
export interface CreateTemplateOptions extends Omit<Config, 'template'> {
  /**
   * 应用场景
   */
  scene?: string
  /**
   * 应用模版
   */
  template?: string
}

/**
 * 通过场景和模版选择创建项目
 */
export class CreateTemplate {
  /**
   * 构造函数选项
   */
  public readonly constructorOptions: Readonly<CreateTemplateOptions>
  /**
   * 当前工作目录
   */
  public readonly cwd: string

  /**
   * 创建模版选择器
   *
   * @param options - 工作目录和默认场景、模版
   */
  public constructor(options: CreateTemplateOptions = {}) {
    if (options.force && options.merge) {
      throw new AppError('`force` and `merge` cannot be enabled together', {
        code: 'CREATE_INVALID_OPTIONS',
        details: { force: true, merge: true },
      })
    }

    this.constructorOptions = Object.freeze({ ...options })
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
    const {
      scene: _scene,
      template: _template,
      ...creatorOptions
    } = this.constructorOptions
    const { description: _description, ...templateSource } = template
    const create = new ProjectCreator({
      ...creatorOptions,
      cwd: this.cwd,
      template: templateSource,
    })
    await create.run(projectName)
  }

  /**
   * 解析交互选择后的远程模版
   *
   * @returns 远程模版配置
   */
  private async _getTemplate(): Promise<RemoteTemplate> {
    this._throwIfAborted('select-scene')
    const { scenes, templates }: TemplateConfig = defaultConfig
    let sceneAnswer = this.constructorOptions.scene
    let templateAnswer = this.constructorOptions.template

    if (sceneAnswer !== undefined && !Object.hasOwn(scenes, sceneAnswer)) {
      throw new AppError(`Unknown application scene \`${sceneAnswer}\``, {
        code: 'CREATE_INVALID_OPTIONS',
        details: { scene: sceneAnswer },
      })
    }

    if (sceneAnswer === undefined) {
      const sceneKeys = Object.keys(scenes)

      if (sceneKeys.length === 1) {
        sceneAnswer = sceneKeys[0]
      } else {
        const answer = await prompts(
          {
            type: 'select',
            name: 'scene',
            message: 'Select the application scene',
            choices: Object.entries(scenes).map(([value, title]) => ({
              title,
              value,
            })),
          },
          {
            onCancel,
          },
        )
        sceneAnswer = answer.scene
        this._throwIfAborted('select-scene')
      }
    }

    if (!sceneAnswer || !Object.hasOwn(scenes, sceneAnswer)) {
      throw new AppError('Expected an application scene', {
        code: 'CREATE_INVALID_OPTIONS',
      })
    }

    const sceneTemplates = templates[sceneAnswer]

    if (
      templateAnswer !== undefined &&
      !Object.hasOwn(sceneTemplates, templateAnswer)
    ) {
      throw new AppError(
        `Unknown application template \`${templateAnswer}\` for scene \`${sceneAnswer}\``,
        {
          code: 'CREATE_INVALID_OPTIONS',
          details: { scene: sceneAnswer, template: templateAnswer },
        },
      )
    }

    if (templateAnswer === undefined) {
      const answer = await prompts(
        {
          type: 'select',
          name: 'template',
          message: 'Select the application template',
          choices: Object.entries(sceneTemplates).map(([value, template]) => ({
            title: template.description,
            value,
          })),
        },
        {
          onCancel,
        },
      )
      templateAnswer = answer.template
      this._throwIfAborted('select-template')
    }

    if (!templateAnswer || !Object.hasOwn(sceneTemplates, templateAnswer)) {
      throw new AppError(
        `Expected an application template for scene \`${sceneAnswer}\``,
        { code: 'CREATE_INVALID_OPTIONS', details: { scene: sceneAnswer } },
      )
    }

    return sceneTemplates[templateAnswer]
  }

  /**
   * 在交互边界将取消信号转换为 create 领域错误
   * @param operation - 当前选择阶段
   * @throws {@link AppError} 调用方已取消时抛出
   */
  private _throwIfAborted(operation: string): void {
    const signal = this.constructorOptions.signal

    if (signal?.aborted) {
      throw new AppError(
        `Create template operation \`${operation}\` was aborted`,
        {
          cause: signal.reason,
          code: 'CREATE_OPERATION_ABORTED',
          details: { operation },
        },
      )
    }
  }
}
