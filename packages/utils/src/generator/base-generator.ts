import chalk from 'chalk'
import { readdirSync } from 'node:fs'
import { EOL } from 'node:os'
import prompts, { type Answers, type PromptObject } from 'prompts'

import { confirm } from '../cli'
import {
  copyDirectory,
  copyDirectorySync,
  copyFile,
  copyFileSync,
  copyTemplate,
  copyTemplateSync,
  type CopyFileOptions,
  type CopyFileSyncOptions,
  type RenderTemplateOptions,
} from '../file'
import { isFunction } from '../guards'
import { logger } from '../logger'

const TARGET_DIR_WHITE_LIST = ['.git', 'LICENSE']

/**
 * 基础生成器类
 */
export class BaseGenerator {
  /**
   * 目标文件基准路径
   */
  public basedir: string | ((prompts: Answers<string>) => string)
  /**
   * 问询结果
   */
  public prompts: Answers<string>
  /**
   * 模版渲染默认选项
   *
   * @remarks
   * 六个复制方法均按字段浅合并调用选项，调用方显式字段（含 `undefined`）优先
   * 嵌套对象整体替换；未传 `renderOptions` 时沿用实例默认值
   */
  public renderTemplateOptions: RenderTemplateOptions | undefined

  private _basedir = ''

  public constructor(
    basedir: BaseGenerator['basedir'],
    renderTemplateOptions?: BaseGenerator['renderTemplateOptions'],
  ) {
    this.basedir = basedir
    this.prompts = {}
    this.renderTemplateOptions = renderTemplateOptions
  }

  /**
   * 执行问询和写入生命周期
   *
   * @returns 写入完成时返回 `true`，子类取消写入时返回 `false`
   * @throws 用户取消问询时抛出错误
   */
  public async run(): Promise<boolean> {
    const questions = this.prompting()
    this.prompts = await prompts(questions, {
      onCancel() {
        throw new Error('Prompt was cancelled')
      },
    })

    if (isFunction(this.basedir)) {
      this._basedir = this.basedir(this.prompts)
    } else {
      this._basedir = this.basedir
    }

    return (await this.writing()) !== false
  }

  public prompting(): PromptObject<string> | Array<PromptObject<string>> {
    return []
  }

  /**
   * 执行生成器写入阶段
   *
   * @returns 返回 `false` 可阻止后续完成回调
   */
  public async writing(): Promise<boolean | void> {
    return undefined
  }

  /**
   * 拷贝文件
   * @param from - 源文件路径
   * @param to - 目标文件路径
   * @param options - 同步复制选项，不支持取消信号；渲染字段浅合并并覆盖实例默认值
   */
  public copyFileSync(
    from: string,
    to: string,
    options: CopyFileSyncOptions = {},
  ) {
    copyFileSync(from, to, {
      ...options,
      renderOptions: this._resolveRenderOptions(options.renderOptions),
      basedir: this._basedir,
    })
  }

  /**
   * 拷贝文件
   * @param from - 源文件路径
   * @param to - 目标文件路径
   * @param options - 复制选项，渲染字段浅合并并覆盖实例默认值
   */
  public async copyFile(
    from: string,
    to: string,
    options: CopyFileOptions = {},
  ) {
    await copyFile(from, to, {
      ...options,
      renderOptions: this._resolveRenderOptions(options.renderOptions),
      basedir: this._basedir,
    })
  }

  /**
   * 拷贝模版
   * @param from - 源文件路径
   * @param to - 目标文件路径
   * @param data - 模版数据
   * @param options - 同步复制选项，不支持取消信号；渲染字段浅合并并覆盖实例默认值
   */
  public copyTplSync(
    from: string,
    to: string,
    data: object,
    options: CopyFileSyncOptions = {},
  ) {
    copyTemplateSync(from, to, data, {
      ...options,
      renderOptions: this._resolveRenderOptions(options.renderOptions),
      basedir: this._basedir,
    })
  }

  /**
   * 拷贝模版
   * @param from - 源文件路径
   * @param to - 目标文件路径
   * @param data - 模版数据
   * @param options - 复制选项，渲染字段浅合并并覆盖实例默认值
   */
  public async copyTpl(
    from: string,
    to: string,
    data: object,
    options: CopyFileOptions = {},
  ) {
    await copyTemplate(from, to, data, {
      ...options,
      renderOptions: this._resolveRenderOptions(options.renderOptions),
      basedir: this._basedir,
    })
  }

  /**
   * 拷贝文件夹
   * @param from - 源文件路径
   * @param to - 目标文件路径
   * @param options - 同步复制选项，不支持取消信号；渲染字段浅合并并覆盖实例默认值
   */
  public copyDirectorySync(
    from: string,
    to: string,
    data: object,
    options: CopyFileSyncOptions = {},
  ) {
    copyDirectorySync(from, to, data, {
      ...options,
      renderOptions: this._resolveRenderOptions(options.renderOptions),
      basedir: this._basedir,
    })
  }

  /**
   * 拷贝文件夹
   * @param from - 源文件路径
   * @param to - 目标文件路径
   * @param options - 复制选项，渲染字段浅合并并覆盖实例默认值
   */
  public async copyDirectory(
    from: string,
    to: string,
    data: object,
    options: CopyFileOptions = {},
  ) {
    await copyDirectory(from, to, data, {
      ...options,
      renderOptions: this._resolveRenderOptions(options.renderOptions),
      basedir: this._basedir,
    })
  }

  /**
   * 按字段应用调用方覆盖，保持嵌套渲染配置整体替换的兼容语义
   */
  private _resolveRenderOptions(
    options: RenderTemplateOptions | undefined,
  ): RenderTemplateOptions | undefined {
    return options === undefined
      ? this.renderTemplateOptions
      : { ...this.renderTemplateOptions, ...options }
  }

  /**
   * 检查文件夹
   * @param targetDir - 目标路径
   */
  public checkDir(targetDir: string) {
    const files = readdirSync(targetDir).filter(
      file => !TARGET_DIR_WHITE_LIST.includes(file),
    )

    if (files.length) {
      logger.warn(`当前文件夹 ${chalk.cyan(targetDir)} 存在如下文件:${EOL}`)
      files.forEach(file => console.log(' - ' + file))
      console.log()
      return confirm(`确定要覆盖当前文件夹吗?`, true)
    }

    return true
  }
}
