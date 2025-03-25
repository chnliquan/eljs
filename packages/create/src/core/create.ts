import type { Config, RemoteTemplate } from '@/types'
import { AppError } from '@/utils'
import {
  confirm,
  createDebugger,
  findUp,
  isDirectory,
  isPathExists,
  isString,
  logger,
  mkdir,
  remove,
  resolve,
  tryPaths,
} from '@eljs/utils'
import { readdir } from 'node:fs/promises'
import { EOL } from 'node:os'
import path, { join } from 'node:path'

import { Download } from './download'
import { Runner } from './runner'

const debug = createDebugger('create:class')

/**
 * Create constructor options
 */
export interface CreateOptions extends Omit<Config, 'template'> {
  /**
   * Local template path or remote template
   */
  template: string | RemoteTemplate
}

/**
 * Create class
 */
export class Create {
  /**
   * 构造函数参数
   */
  public constructorOptions: CreateOptions
  /**
   * 当前工作目录
   */
  public cwd: string
  /**
   * 模版
   */
  public template: CreateOptions['template']
  /**
   * 模版根路径
   */
  public _templateRootPath!: string
  /**
   * 是否为本地模版
   */
  private _isLocal = false

  public constructor(options: CreateOptions) {
    const { cwd = process.cwd(), template } = options

    this.constructorOptions = options
    this.cwd = cwd
    this.template = template
  }

  /**
   * 运行创建流程
   * @param projectName 项目名称
   */
  public async run(projectName: string) {
    try {
      const targetDir = path.resolve(this.cwd, projectName)

      debug?.(`targetDir:`, targetDir)
      debug?.(`projectName:`, projectName)

      if (!(await isPathExists(targetDir))) {
        await mkdir(targetDir)
      } else {
        const overwrite = await this._checkTargetDir(targetDir)

        if (!overwrite) {
          return
        }
        await remove(targetDir)
        await mkdir(targetDir)
      }

      await this._resolveTemplate()
      debug?.(`templateRootPath`, this._templateRootPath)

      const configFile = await tryPaths([
        join(this._templateRootPath, 'create.config.ts'),
        join(this._templateRootPath, 'create.config.js'),
      ])

      const generatorFile = await tryPaths([
        join(this._templateRootPath, 'generators/index.ts'),
        join(this._templateRootPath, 'generators/index.js'),
      ])

      if (!generatorFile && !configFile) {
        throw new AppError(
          `Invalid template ${this._templateRootPath}, missing \`create.config.ts\` or \`generators/index.ts\`.`,
        )
      }

      const runner = new Runner({
        cwd: this._templateRootPath,
        plugins: generatorFile ? [generatorFile] : [],
      })

      await runner.run(targetDir, projectName)
    } finally {
      if (!this._isLocal && (await isPathExists(this._templateRootPath))) {
        await remove(this._templateRootPath)
      }
    }
  }

  /**
   * 检查目标文件夹
   * @param targetDir 目标文件夹
   */
  private async _checkTargetDir(targetDir: string): Promise<boolean> {
    if (this.constructorOptions.force) {
      return true
    }

    const files = await readdir(targetDir)

    if (files.length) {
      logger.warn(
        `The current folder ${targetDir} contains the following files:${EOL}`,
      )
      files.forEach(file => console.log(' - ' + file))
      console.log()
      return confirm(`Are you sure to overwrite the current folder?`, true)
    }

    return true
  }

  /**
   * 解析模版
   */
  private async _resolveTemplate() {
    if (isString(this.template)) {
      // 处理本地模版
      if (this.template.startsWith('.') || this.template.startsWith('/')) {
        const templateRootPath = join(this.cwd, this.template)

        if (!(await isDirectory(templateRootPath))) {
          throw new AppError(`Invalid local template ${this.template}.`)
        }

        this._templateRootPath = templateRootPath
        this._isLocal = true
        return
      }

      // 处理 node_modules
      try {
        const cwd = resolve.sync(this.template, {
          basedir: this.cwd,
        })

        this._templateRootPath = (await findUp(
          async directory => {
            const exist = await isPathExists(
              path.join(directory, 'package.json'),
            )
            if (exist) {
              return directory
            }

            return
          },
          { cwd, type: 'directory' },
        )) as string
        this._isLocal = true
        return
      } catch (_) {
        this.template = {
          type: 'npm',
          value: this.template,
        }
      }
    }

    const download = new Download(this.template)
    this._templateRootPath = await download.download()
  }
}
