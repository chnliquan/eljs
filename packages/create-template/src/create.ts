import {
  AppError,
  ProjectCreator,
  type Config,
  type RemoteTemplate as CreateRemoteTemplate,
} from '@eljs/create'
import { prompts } from '@eljs/utils/cli'

import {
  defaultConfig,
  type RemoteTemplate,
  type TemplateConfig,
} from './config'
import { objectToArray, onCancel } from './utils'

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
  /**
   * 场景和可选模版目录
   *
   * @remarks
   * 未传入时使用内置官方目录；调用方可通过本地模版目录进行离线或企业场景扩展
   */
  catalog?: TemplateConfig
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
  /** 已校验并与调用方输入隔离的模版目录快照 */
  private readonly _catalog: TemplateConfig

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

    this._catalog = validateAndSnapshotCatalog(options.catalog ?? defaultConfig)
    this.constructorOptions = Object.freeze({
      ...options,
      ...(options.catalog ? { catalog: this._catalog } : {}),
    })
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
      catalog: _catalog,
      scene: _scene,
      template: _template,
      ...creatorOptions
    } = this.constructorOptions
    const create = new ProjectCreator({
      ...creatorOptions,
      cwd: this.cwd,
      template: toProjectTemplate(template),
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
    const { scenes, templates } = this._catalog
    let sceneAnswer = this.constructorOptions.scene
    let templateAnswer = this.constructorOptions.template

    if (sceneAnswer !== undefined && !Object.hasOwn(scenes, sceneAnswer)) {
      throw new AppError(`Unknown application scene \`${sceneAnswer}\``, {
        code: 'CREATE_INVALID_OPTIONS',
        details: { scene: sceneAnswer },
      })
    }

    if (sceneAnswer === undefined) {
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
      this._throwIfAborted('select-scene')
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
          choices: this._formatTemplate(sceneTemplates),
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

/**
 * 校验外部模版目录并生成不可变快照
 *
 * @remarks
 * 目录可能来自 JavaScript 调用方或动态配置，运行时校验用于阻止缺失场景、危险原型键
 * 和无效模版来源进入交互及下载边界；深复制确保调用方后续修改不改变本次创建行为
 *
 * @param catalog - 未经信任的模版目录值
 * @returns 通过校验且深度冻结的目录快照
 * @throws {@link AppError} 目录结构或字段不符合契约时抛出
 * @internal
 */
function validateAndSnapshotCatalog(catalog: unknown): TemplateConfig {
  if (!isRecord(catalog)) {
    throwInvalidCatalog('Template catalog must be an object')
  }

  const { scenes, templates } = catalog
  if (!isRecord(scenes) || !isRecord(templates)) {
    throwInvalidCatalog('Template catalog must define scenes and templates')
  }

  const sceneKeys = Object.keys(scenes)
  if (sceneKeys.length === 0) {
    throwInvalidCatalog('Template catalog must contain at least one scene')
  }

  const sceneSnapshot: Record<string, string> = {}
  const templateSnapshot: Record<string, Record<string, RemoteTemplate>> = {}

  for (const scene of sceneKeys) {
    if (!isSafeCatalogKey(scene)) {
      throwInvalidCatalog('Template catalog contains an unsafe scene key', {
        scene,
      })
    }

    const title = scenes[scene]
    if (!isNonEmptyString(title)) {
      throwInvalidCatalog('Template scene titles must be non-empty strings', {
        scene,
      })
    }

    const sceneTemplates = templates[scene]
    if (!isRecord(sceneTemplates) || Object.keys(sceneTemplates).length === 0) {
      throwInvalidCatalog('Every template scene must contain a template', {
        scene,
      })
    }

    sceneSnapshot[scene] = title
    const entries: Record<string, RemoteTemplate> = {}

    for (const [templateName, value] of Object.entries(sceneTemplates)) {
      if (!isSafeCatalogKey(templateName)) {
        throwInvalidCatalog(
          'Template catalog contains an unsafe template key',
          {
            scene,
            template: templateName,
          },
        )
      }

      if (!isRecord(value)) {
        throwInvalidCatalog('Template entries must be objects', {
          scene,
          template: templateName,
        })
      }

      const { description, registry, trusted, type, value: source } = value
      if (
        !['git', 'local', 'npm'].includes(String(type)) ||
        !isNonEmptyString(source) ||
        !isNonEmptyString(description) ||
        (trusted !== undefined && typeof trusted !== 'boolean') ||
        (registry !== undefined && !isHttpUrl(registry))
      ) {
        throwInvalidCatalog('Template entry fields are invalid', {
          scene,
          template: templateName,
        })
      }

      entries[templateName] = Object.freeze({
        description,
        type: type as RemoteTemplate['type'],
        value: source,
        ...(registry !== undefined ? { registry } : {}),
        ...(trusted !== undefined ? { trusted } : {}),
      })
    }

    templateSnapshot[scene] = Object.freeze(entries)
  }

  const orphanScene = Object.keys(templates).find(
    scene => !Object.hasOwn(scenes, scene),
  )
  if (orphanScene) {
    throwInvalidCatalog('Template catalog contains an unknown scene', {
      scene: orphanScene,
    })
  }

  return Object.freeze({
    scenes: Object.freeze(sceneSnapshot),
    templates: Object.freeze(templateSnapshot),
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isSafeCatalogKey(value: string): boolean {
  return !['__proto__', 'constructor', 'prototype'].includes(value)
}

function isHttpUrl(value: unknown): value is string {
  if (!isNonEmptyString(value)) {
    return false
  }

  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

/**
 * 将不可信目录输入的校验失败转换为稳定领域错误
 *
 * @param message - 面向调用方的错误摘要
 * @param details - 不包含敏感值的结构化诊断信息
 * @throws 始终抛出目录契约错误
 * @internal
 */
function throwInvalidCatalog(
  message: string,
  details?: Readonly<Record<string, unknown>>,
): never {
  throw new AppError(message, {
    code: 'CREATE_INVALID_CATALOG',
    details,
  })
}

/**
 * 将目录中的可选择模版转换为底层 ProjectCreator 接受的来源声明
 *
 * @remarks
 * 描述字段只服务于交互展示，不继续泄漏到执行引擎；本地模版转换为路径字符串，
 * npm 和 Git 模版只传递下载与信任决策需要的字段
 *
 * @param template - 用户最终选择的目录项
 * @returns 本地路径或远程模版声明
 */
function toProjectTemplate(
  template: RemoteTemplate,
): string | CreateRemoteTemplate {
  if (template.type === 'local') {
    return template.value
  }

  const { type, value, registry, trusted } = template

  return {
    type,
    value,
    ...(registry ? { registry } : {}),
    ...(trusted !== undefined ? { trusted } : {}),
  }
}
