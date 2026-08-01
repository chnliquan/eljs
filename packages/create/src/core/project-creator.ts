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

import type { Config, RemoteTemplate } from '../types'
import { AppError } from '../utils'
import { CreateRunner } from './create-runner'
import {
  TemplateDownloader,
  type TemplateDownloadOptions,
} from './template-downloader'

const debug = createDebugger('create:class')

/**
 * 创建项目编排器选项
 */
export interface ProjectCreatorOptions extends Omit<Config, 'template'> {
  /**
   * Local template path or remote template
   */
  template: string | RemoteTemplate
}

/**
 * 负责解析模版、保护目标目录并启动项目生成流程
 */
export class ProjectCreator {
  /**
   * 构造函数选项
   */
  public readonly constructorOptions: Readonly<ProjectCreatorOptions>
  /**
   * 当前工作目录
   */
  public readonly cwd: string
  /**
   * 当前模版声明
   */
  private _template: ProjectCreatorOptions['template']
  /**
   * 模版根路径
   */
  private _templateRootPath?: string
  /**
   * 是否为本地模版
   */
  private _isLocal = false

  /**
   * 当前模版声明
   *
   * @returns 本地路径或远程模版描述
   */
  public get template(): ProjectCreatorOptions['template'] {
    return this._template
  }

  /**
   * 创建项目生成编排器
   *
   * @param options - 工作目录、模版和生成行为
   */
  public constructor(options: ProjectCreatorOptions) {
    const { cwd = process.cwd(), template } = options

    const templateSnapshot = isString(template)
      ? template
      : Object.freeze({ ...template })
    this.constructorOptions = Object.freeze({
      ...options,
      template: templateSnapshot,
    })
    this.cwd = cwd
    this._template = templateSnapshot
  }

  /**
   * 运行创建流程
   *
   * @param projectName - 项目名称
   * @returns 创建流程结束后兑现的 Promise
   * @throws {@link AppError}
   * 当项目名称、模版或目标目录无效时抛出
   */
  public async run(projectName: string): Promise<void> {
    try {
      const targetDir = this._resolveTargetDir(projectName)

      debug?.(`targetDir:`, targetDir)
      debug?.(`projectName:`, projectName)

      const shouldContinue = await this._resolveTemplate()
      if (!shouldContinue) {
        return
      }
      const templateRootPath = this._getTemplateRootPath()

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
      debug?.(`templateRootPath`, templateRootPath)

      const configFile = await tryPaths([
        join(templateRootPath, 'create.config.ts'),
        join(templateRootPath, 'create.config.js'),
      ])

      const generatorFile = await tryPaths([
        join(templateRootPath, 'generators/index.ts'),
        join(templateRootPath, 'generators/index.js'),
      ])

      if (!generatorFile && !configFile) {
        throw new AppError(
          `Invalid template ${chalk.cyan(templateRootPath)}, missing \`create.config.ts\` or \`generators/index.ts\`.`,
        )
      }

      const {
        cwd: _cwd,
        template: _template,
        plugins = [],
        ...runnerOptions
      } = this.constructorOptions
      const runner = new CreateRunner({
        ...runnerOptions,
        cwd: templateRootPath,
        plugins: [...(generatorFile ? [generatorFile] : []), ...plugins],
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
   * the configured working directory
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
    if (isString(this._template)) {
      // 处理本地模版
      if (this._template.startsWith('.') || path.isAbsolute(this._template)) {
        const templateRootPath = path.resolve(this.cwd, this._template)

        if (!(await isDirectory(templateRootPath))) {
          throw new AppError(
            `Invalid local template ${chalk.cyan(this._template)}.`,
          )
        }

        this._templateRootPath = templateRootPath
        this._isLocal = true
        return true
      }

      // 处理 node_modules
      try {
        const cwd = resolve.sync(this._template, {
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
        this._template = {
          type: 'npm',
          value: this._template,
        }
      }
    }

    if (!this._template.trusted && !this.constructorOptions.yes) {
      logger.warn(
        `Remote template ${chalk.cyan(this._template.value)} can execute code with your user permissions.`,
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

    const downloadOptions: TemplateDownloadOptions = { ...this._template }
    if (this.constructorOptions.allowTemplateScripts !== undefined) {
      downloadOptions.allowScripts =
        this.constructorOptions.allowTemplateScripts
    }

    const download = new TemplateDownloader(downloadOptions)
    this._templateRootPath = await download.download()
    return true
  }

  /**
   * 获取已经解析完成的模版根目录
   *
   * @returns 模版根目录绝对路径
   * @throws {@link AppError}
   * 当模版解析流程没有产生目录时抛出
   */
  private _getTemplateRootPath(): string {
    if (!this._templateRootPath) {
      throw new AppError(`Template root path has not been resolved.`)
    }

    return this._templateRootPath
  }
}
