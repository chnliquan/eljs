import {
  chalk,
  createDebugger,
  findUp,
  isDirectory,
  isPathExists,
  isString,
  logger,
  mkdir,
  prompts,
  remove,
  resolve,
  tryPaths,
} from '@eljs/utils'
import path, { join } from 'node:path'

import type { Config, RemoteTemplate } from '../types/index.js'
import { AppError } from '../utils.js'
import { Download, type DownloadOptions } from './download.js'
import { Runner } from './runner.js'

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
   * 构造函数选项
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
      const targetDir = this._resolveTargetDir(projectName)

      debug?.(`targetDir:`, targetDir)
      debug?.(`projectName:`, projectName)

      const shouldContinue = await this._resolveTemplate()
      if (!shouldContinue) {
        return
      }

      if ((await isPathExists(targetDir)) && !this.constructorOptions.merge) {
        if (this.constructorOptions.force) {
          await remove(targetDir)
        } else {
          logger.clear()
          const { action } = await prompts([
            {
              name: 'action',
              type: 'select',
              message: `Target directory ${chalk.cyan(targetDir)} already exists, pick an action:`,
              choices: [
                { title: 'Overwrite', value: 'overwrite' },
                { title: 'Merge', value: 'merge' },
                { title: 'Cancel', value: false },
              ],
            },
          ])

          if (!action) {
            return
          } else if (action === 'overwrite') {
            logger.event(`Removing ${chalk.cyan(targetDir)} ...`)
            await remove(targetDir)
          }
        }
      }

      await mkdir(targetDir)
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
          `Invalid template ${chalk.cyan(this._templateRootPath)}, missing \`create.config.ts\` or \`generators/index.ts\`.`,
        )
      }

      const runner = new Runner({
        cwd: this._templateRootPath,
        plugins: generatorFile ? [generatorFile] : [],
      })

      await runner.run(targetDir, projectName)
    } finally {
      if (
        !this._isLocal &&
        this._templateRootPath &&
        (await isPathExists(this._templateRootPath))
      ) {
        await remove(this._templateRootPath)
      }
    }
  }

  /**
   * Resolve the project target and ensure destructive operations cannot escape
   * the configured working directory.
   */
  private _resolveTargetDir(projectName: string): string {
    const cwd = path.resolve(this.cwd)
    const targetDir = path.resolve(cwd, projectName)
    const relativeTarget = path.relative(cwd, targetDir)

    if (
      !projectName.trim() ||
      !relativeTarget ||
      relativeTarget === '..' ||
      relativeTarget.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativeTarget)
    ) {
      throw new AppError(
        `Invalid project name ${chalk.cyan(projectName)}: target directory must be inside ${chalk.cyan(cwd)}.`,
      )
    }

    return targetDir
  }

  /**
   * 解析模版
   */
  private async _resolveTemplate(): Promise<boolean> {
    if (isString(this.template)) {
      // 处理本地模版
      if (this.template.startsWith('.') || path.isAbsolute(this.template)) {
        const templateRootPath = path.resolve(this.cwd, this.template)

        if (!(await isDirectory(templateRootPath))) {
          throw new AppError(
            `Invalid local template ${chalk.cyan(this.template)}.`,
          )
        }

        this._templateRootPath = templateRootPath
        this._isLocal = true
        return true
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
        return true
      } catch (_) {
        this.template = {
          type: 'npm',
          value: this.template,
        }
      }
    }

    if (!this.template.trusted && !this.constructorOptions.yes) {
      logger.warn(
        `Remote template ${chalk.cyan(this.template.value)} can execute code with your user permissions.`,
      )
      const { confirmed } = await prompts({
        name: 'confirmed',
        type: 'confirm',
        message: 'Download and execute this template?',
        initial: false,
      })

      if (confirmed !== true) {
        return false
      }
    }

    const downloadOptions: DownloadOptions = { ...this.template }
    if (this.constructorOptions.allowTemplateScripts !== undefined) {
      downloadOptions.allowScripts =
        this.constructorOptions.allowTemplateScripts
    }

    const download = new Download(downloadOptions)
    this._templateRootPath = await download.download()
    return true
  }
}
