import { AppError, ProjectCreator, type Config } from '@eljs/create'
import { prompts } from '@eljs/utils/cli'
import { logger } from '@eljs/utils/logger'

import {
  officialTemplates,
  type OfficialTemplate,
  type OfficialTemplateName,
} from './official-templates'

export type { OfficialTemplateName } from './official-templates'

/**
 * 构造函数选项
 */
export interface CreateTemplateOptions extends Omit<Config, 'template'> {
  /**
   * 内置模板标识
   */
  template?: OfficialTemplateName
}

/**
 * 从内置官方模板中选择并创建项目
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
   * 创建模板选择器
   *
   * @param options - 项目创建选项和默认模板
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
   * 解析模板并运行项目创建流程
   *
   * @param projectName - 项目名称
   * @returns 创建流程结束后兑现的 Promise
   */
  public async run(projectName: string): Promise<void> {
    const template = await this._getTemplate()
    const { template: _template, ...creatorOptions } = this.constructorOptions
    const { description: _description, ...templateSource } = template
    const create = new ProjectCreator({
      ...creatorOptions,
      cwd: this.cwd,
      template: templateSource,
    })
    await create.run(projectName)
  }

  /**
   * 解析交互选择后的远程模板
   *
   * @returns 远程模板配置
   */
  private async _getTemplate(): Promise<OfficialTemplate> {
    this._throwIfAborted('select-template')
    let templateAnswer: string | undefined = this.constructorOptions.template

    if (
      templateAnswer !== undefined &&
      !isOfficialTemplateName(templateAnswer)
    ) {
      throw new AppError(`Unknown application template \`${templateAnswer}\``, {
        code: 'CREATE_INVALID_OPTIONS',
        details: { template: templateAnswer },
      })
    }

    if (templateAnswer === undefined) {
      const answer = await prompts(
        {
          type: 'select',
          name: 'template',
          message: 'Select the application template',
          choices: Object.entries(officialTemplates).map(
            ([value, template]) => ({
              title: template.description,
              value,
            }),
          ),
        },
        {
          onCancel: handleTemplateSelectionCancel,
        },
      )
      templateAnswer = answer.template
      this._throwIfAborted('select-template')
    }

    if (!templateAnswer || !isOfficialTemplateName(templateAnswer)) {
      throw new AppError('Expected an application template', {
        code: 'CREATE_INVALID_OPTIONS',
      })
    }

    return officialTemplates[templateAnswer]
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

function isOfficialTemplateName(value: string): value is OfficialTemplateName {
  return Object.hasOwn(officialTemplates, value)
}

function handleTemplateSelectionCancel(): never {
  try {
    logger.event('Cancel create template')
  } catch {
    // 交互取消必须保留稳定错误语义，不能被日志实现覆盖
  }
  throw new AppError('Create template operation was cancelled by the user', {
    code: 'CREATE_OPERATION_CANCELLED',
  })
}
