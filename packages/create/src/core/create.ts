import {
  chalk,
  confirm,
  isDirectory,
  isPathExistsSync,
  logger,
  mkdirSync,
  removeSync,
} from '@eljs/utils'
import assert from 'assert'
import { readdirSync } from 'fs'
import path from 'path'

import type { CreateOpts, TemplateInfo } from '../types'
import { Download } from './download'
import { Generator } from './generator'

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
      opts.template || opts.templateInfo,
      `请传入 \`templateInfo\` 或者 \`template\``,
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

  public get templateInfo() {
    return this._opts.templateInfo
  }

  public async run(projectName: string) {
    let templatePath = ''

    try {
      const name =
        projectName === '.' ? path.relative('../', this.cwd) : projectName
      const targetDir = path.resolve(this.cwd, projectName)

      if (!isPathExistsSync(targetDir)) {
        mkdirSync(targetDir)
      } else {
        const override = await this._checkTargetDir(targetDir)

        if (!override) {
          return
        }
      }

      templatePath = (await this._getTemplatePath()) as string

      const generator = new Generator({
        isLocalTemplate: !!this._localTemplatePath,
        projectName: name,
        targetDir,
        args: this._opts.args,
        isGenSchema: this._opts.schema,
      })

      await generator.create(templatePath)
    } catch (err) {
      console.log()
      logger.error('创建模版失败，错误信息如下：')
      throw err
    } finally {
      this._removeTemplate(templatePath)
    }
  }

  private async _ensureLocalTemplate(localTemplatePath?: string) {
    if (!localTemplatePath) {
      return
    }

    this._localTemplatePath = path.join(this._cwd, localTemplatePath)

    assert(
      isPathExistsSync(this._localTemplatePath),
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

  private async _getTemplatePath() {
    if (this._localTemplatePath) {
      return this._localTemplatePath
    }

    const download = new Download(this.templateInfo as TemplateInfo)
    return download.download()
  }

  private _removeTemplate(templatePath: string) {
    if (!this._localTemplatePath && isPathExistsSync(templatePath)) {
      removeSync(templatePath)
    }
  }
}
