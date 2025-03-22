import type { CreateOptions } from '@/types'
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

import { AppError } from '@/utils'
import { Download } from './download'
import { Runner } from './runner'

const TARGET_DIR_WHITE_LIST = ['.git', 'LICENSE']

const debug = createDebugger('create:class')

export class Create {
  /**
   * 构造函数参数
   */
  public constructorOptions: CreateOptions
  /**
   * 当前路径
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
   * 执行创建
   * @param projectName 项目名
   */
  public async run(projectName: string) {
    try {
      const targetDir = path.resolve(this.cwd, projectName)

      debug?.(`targetDir:`, targetDir)
      debug?.(`projectName:`, projectName)

      if (!(await isPathExists(targetDir))) {
        await mkdir(targetDir)
      } else {
        const override = await this._checkTargetDir(targetDir)

        if (!override) {
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
          `Invalid template in ${this._templateRootPath}, missing \`create.config.ts\` or \`generators/index.ts\`.`,
        )
      }

      const runner = new Runner({
        cwd: this._templateRootPath,
        plugins: generatorFile ? [generatorFile] : [],
      })

      await runner.run(targetDir, projectName)
    } catch (error) {
      if (error instanceof AppError) {
        logger.error(error.message)
      } else {
        console.log(error)
      }
      throw error
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
    if (this.constructorOptions.override) {
      return true
    }

    const files = (await readdir(targetDir)).filter(
      file => !TARGET_DIR_WHITE_LIST.includes(file),
    )

    if (files.length) {
      logger.warn(
        `The current folder ${targetDir} contains the following files:${EOL}`,
      )
      files.forEach(file => console.log(' - ' + file))
      console.log()
      return confirm(`Are you sure to override the current folder?`, true)
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
        const path = join(this.cwd, this.template)

        if (!(await isDirectory(path))) {
          throw new AppError(`Invalid local template ${this.template}.`)
        }

        this._isLocal = true
        this._templateRootPath = path
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
