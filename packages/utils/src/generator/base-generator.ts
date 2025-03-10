import { confirm } from '@/cli'
import {
  copyDirectory,
  copyDirectorySync,
  copyFile,
  copyFileSync,
  copyTpl,
  copyTplSync,
  type CopyFileOptions,
  type RenderTemplateOptions,
} from '@/file'
import { logger } from '@/logger'
import { isFunction } from '@/type'
import chalk from 'chalk'
import { readdirSync } from 'node:fs'
import prompts, { type Answers, type PromptObject } from 'prompts'

const TARGET_DIR_WHITE_LIST = ['.git', 'LICENSE']

/**
 * 基础生成器类
 */
export class BaseGenerator {
  /**
   * 目标文件基准路径
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public basedir: string | ((prompts: Record<string, any>) => string)
  /**
   * 问询结果
   */
  public prompts: Answers<string>
  /**
   * 模版渲染配置项
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

  public async run() {
    const questions = this.prompting()
    this.prompts = await prompts(questions)

    if (isFunction(this.basedir)) {
      this._basedir = this.basedir(this.prompts)
    } else {
      this._basedir = this.basedir
    }

    await this.writing()
  }

  public prompting(): PromptObject<string> | Array<PromptObject<string>> {
    return []
  }

  public async writing() {
    // ...
  }

  /**
   * 拷贝文件
   * @param from 源文件路径
   * @param to 目标文件路径
   * @param options 可选配置项
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
   * @param from 源文件路径
   * @param to 目标文件路径
   * @param options 可选配置项
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
   * @param from 源文件路径
   * @param to 目标文件路径
   * @param data 模版数据
   * @param options 可选配置项
   */
  public copyTplSync(
    from: string,
    to: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: Record<string, any>,
    options: CopyFileOptions = {},
  ) {
    copyTplSync(from, to, data, {
      ...options,
      renderOptions: this.renderTemplateOptions,
      basedir: this._basedir,
    })
  }

  /**
   * 拷贝模版
   * @param from 源文件路径
   * @param to 目标文件路径
   * @param data 模版数据
   * @param options 可选配置项
   */
  public async copyTpl(
    from: string,
    to: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: Record<string, any>,
    options: CopyFileOptions = {},
  ) {
    await copyTpl(from, to, data, {
      ...options,
      renderOptions: this.renderTemplateOptions,
      basedir: this._basedir,
    })
  }

  /**
   * 拷贝文件夹
   * @param from 源文件路径
   * @param to 目标文件路径
   * @param options 可选配置项
   */
  public copyDirectorySync(
    from: string,
    to: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: Record<string, any>,
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
   * @param from 源文件路径
   * @param to 目标文件路径
   * @param options 可选配置项
   */
  public async copyDirectory(
    from: string,
    to: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: Record<string, any>,
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
   * @param targetDir 目标路径
   */
  public checkDir(targetDir: string) {
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
}
