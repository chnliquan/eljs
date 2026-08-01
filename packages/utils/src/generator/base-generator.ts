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
   * 模版渲染选项
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
   */
  public async run(): Promise<boolean> {
    const questions = this.prompting()
    this.prompts = await prompts(questions)

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
   * @param options - 选项
   */
  public copyFileSync(from: string, to: string, options: CopyFileOptions = {}) {
    copyFileSync(from, to, {
      ...options,
      renderOptions: this.renderTemplateOptions,
      basedir: this._basedir,
    })
  }

  /**
   * 拷贝文件
   * @param from - 源文件路径
   * @param to - 目标文件路径
   * @param options - 选项
   */
  public async copyFile(
    from: string,
    to: string,
    options: CopyFileOptions = {},
  ) {
    await copyFile(from, to, {
      ...options,
      renderOptions: this.renderTemplateOptions,
      basedir: this._basedir,
    })
  }

  /**
   * 拷贝模版
   * @param from - 源文件路径
   * @param to - 目标文件路径
   * @param data - 模版数据
   * @param options - 选项
   */
  public copyTplSync(
    from: string,
    to: string,
    data: object,
    options: CopyFileOptions = {},
  ) {
    copyTemplateSync(from, to, data, {
      ...options,
      renderOptions: this.renderTemplateOptions,
      basedir: this._basedir,
    })
  }

  /**
   * 拷贝模版
   * @param from - 源文件路径
   * @param to - 目标文件路径
   * @param data - 模版数据
   * @param options - 选项
   */
  public async copyTpl(
    from: string,
    to: string,
    data: object,
    options: CopyFileOptions = {},
  ) {
    await copyTemplate(from, to, data, {
      ...options,
      renderOptions: this.renderTemplateOptions,
      basedir: this._basedir,
    })
  }

  /**
   * 拷贝文件夹
   * @param from - 源文件路径
   * @param to - 目标文件路径
   * @param options - 选项
   */
  public copyDirectorySync(
    from: string,
    to: string,
    data: object,
    options: CopyFileOptions = {},
  ) {
    copyDirectorySync(from, to, data, {
      ...options,
      renderOptions: this.renderTemplateOptions,
      basedir: this._basedir,
    })
  }

  /**
   * 拷贝文件夹
   * @param from - 源文件路径
   * @param to - 目标文件路径
   * @param options - 选项
   */
  public async copyDirectory(
    from: string,
    to: string,
    data: object,
    options: CopyFileOptions = {},
  ) {
    await copyDirectory(from, to, data, {
      ...options,
      renderOptions: this.renderTemplateOptions,
      basedir: this._basedir,
    })
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
