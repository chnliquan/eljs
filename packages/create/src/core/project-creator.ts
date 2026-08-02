import { prompts } from '@eljs/utils/cli'
import { isDirectory, mkdir, move, pathExists, remove } from '@eljs/utils/file'
import { isString } from '@eljs/utils/guards'
import { chalk, createDebugger, logger } from '@eljs/utils/logger'
import { findUp, resolve } from '@eljs/utils/module'
import { findExistingPath } from '@eljs/utils/path'
import { randomUUID } from 'node:crypto'
import { cp } from 'node:fs/promises'
import path, { join } from 'node:path'

import type { Config, RemoteTemplate } from '../types'
import { AppError } from '../utils'
import { resolveProspectiveCanonicalPath } from './canonical-path'
import { CreateRunner } from './create-runner'
import {
  acquireTargetLock,
  releaseTargetLock,
  type TargetLock,
  updateTargetLockBackup,
} from './target-lock'
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
   * 本地模版路径或远程模版来源
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
    if (options.force && options.merge) {
      throw new AppError('`force` and `merge` cannot be enabled together', {
        code: 'CREATE_INVALID_OPTIONS',
        details: { force: true, merge: true },
      })
    }

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
    this._throwIfAborted('resolve-target')
    const targetDir = await this._resolveTargetDir(projectName)
    const targetLock = await acquireTargetLock(
      path.resolve(this.cwd),
      targetDir,
    )
    let runFailure: { error: unknown } | undefined

    try {
      await this._runProject(projectName, targetDir, targetLock)
    } catch (error) {
      runFailure = { error }
    }

    let cleanupFailure: { cleanupRootPath: string; error: unknown } | undefined
    if (
      !this._isLocal &&
      this._templateRootPath &&
      (await pathExists(this._templateRootPath))
    ) {
      const cleanupRootPath =
        !isString(this._template) && this._template.type === 'git'
          ? path.dirname(this._templateRootPath)
          : this._templateRootPath

      try {
        await remove(cleanupRootPath)
      } catch (error) {
        cleanupFailure = { cleanupRootPath, error }
      }
    }

    let lockCleanupFailure: unknown
    try {
      await releaseTargetLock(targetLock)
    } catch (error) {
      lockCleanupFailure = error
    }

    if (lockCleanupFailure) {
      const failures = [
        ...(runFailure ? [runFailure.error] : []),
        ...(cleanupFailure ? [cleanupFailure.error] : []),
        lockCleanupFailure,
      ]
      throw new AppError('Target lock cleanup failed', {
        cause: new AggregateError(failures),
        code: 'CREATE_CLEANUP_FAILED',
        details: { lockPath: targetLock.path, targetDir },
      })
    }

    if (cleanupFailure) {
      if (runFailure) {
        throw new AppError(
          'Project creation failed and remote template cleanup also failed',
          {
            cause: new AggregateError([runFailure.error, cleanupFailure.error]),
            code: 'CREATE_CLEANUP_FAILED',
            details: { cleanupRootPath: cleanupFailure.cleanupRootPath },
          },
        )
      }

      throw new AppError(
        `Project was created, but remote template cleanup failed: ${(cleanupFailure.error as Error).message}`,
        {
          cause: cleanupFailure.error,
          code: 'CREATE_CLEANUP_FAILED',
          details: { cleanupRootPath: cleanupFailure.cleanupRootPath },
        },
      )
    }

    if (runFailure) {
      throw runFailure.error
    }
  }

  /**
   * 执行创建事务主体，由 `run` 统一处理远程模版清理与错误聚合
   *
   * @param projectName - 项目名称
   * @param targetDir - 已通过边界校验并加锁的目标目录
   * @param targetLock - 当前创建流程持有的目标锁
   * @returns 创建事务主体完成后兑现的 Promise
   * @internal
   */
  private async _runProject(
    projectName: string,
    targetDir: string,
    targetLock: TargetLock,
  ): Promise<void> {
    debug?.(`targetDir:`, targetDir)
    debug?.(`projectName:`, projectName)

    const shouldContinue = await this._resolveTemplate()
    if (!shouldContinue) {
      return
    }
    this._throwIfAborted('validate-template')
    const templateRootPath = this._getTemplateRootPath()

    if (this._isLocal) {
      await assertPathsDoNotOverlap(templateRootPath, targetDir)
    }

    const configFile = await findExistingPath([
      join(templateRootPath, 'create.config.ts'),
      join(templateRootPath, 'create.config.js'),
    ])

    const generatorFile = await findExistingPath([
      join(templateRootPath, 'generators/index.ts'),
      join(templateRootPath, 'generators/index.js'),
    ])

    if (!generatorFile && !configFile) {
      throw new AppError(
        `Invalid template ${chalk.cyan(templateRootPath)}, missing \`create.config.ts\` or \`generators/index.ts\`.`,
        {
          code: 'CREATE_INVALID_TEMPLATE',
          details: { templateRootPath },
        },
      )
    }

    const targetExists = await pathExists(targetDir)
    let shouldOverwrite = false
    let shouldMergeExisting = Boolean(
      targetExists && this.constructorOptions.merge,
    )

    if (targetExists && !this.constructorOptions.merge) {
      if (this.constructorOptions.force) {
        shouldOverwrite = true
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
          shouldOverwrite = true
        } else if (action === 'merge') {
          shouldMergeExisting = true
        }
      }
    }

    let backupPath: string | undefined
    const ownsTarget = !targetExists || shouldOverwrite || shouldMergeExisting

    try {
      if (shouldOverwrite || shouldMergeExisting) {
        this._throwIfAborted('backup-target')
        backupPath = join(
          path.resolve(this.cwd),
          `.eljs-backup-${randomUUID()}`,
        )
        try {
          logger.event(`Backing up ${chalk.cyan(targetDir)} ...`)
        } catch {
          // 日志失败不能阻止已加锁目标进入可恢复备份流程
        }
        await updateTargetLockBackup(targetLock, backupPath)
        await move(targetDir, backupPath)
      }

      this._throwIfAborted('generate-project')
      if (shouldMergeExisting && backupPath) {
        // 在原目录副本上执行 merge，失败时可直接丢弃副本并恢复原目录
        await cp(backupPath, targetDir, {
          recursive: true,
          force: true,
          preserveTimestamps: true,
          verbatimSymlinks: true,
        })
      } else {
        await mkdir(targetDir)
      }
      debug?.(`templateRootPath`, templateRootPath)

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
      this._throwIfAborted('commit-target')

      if (backupPath) {
        await updateTargetLockBackup(targetLock, undefined)
        await remove(backupPath)
        backupPath = undefined
      }
    } catch (error) {
      try {
        if (backupPath) {
          if (await pathExists(backupPath)) {
            await move(backupPath, targetDir, true)
          } else if (!(await pathExists(targetDir))) {
            throw new Error(
              'Both the original target and its backup are missing',
              { cause: error },
            )
          }
          await updateTargetLockBackup(targetLock, undefined)
          backupPath = undefined
        } else if (ownsTarget && (await pathExists(targetDir))) {
          await remove(targetDir)
        }
      } catch (recoveryError) {
        throw new AppError(
          `Create project failed and target recovery also failed${backupPath ? `; the original target is preserved at ${chalk.cyan(backupPath)}` : ''}: ${(recoveryError as Error).message}`,
          {
            cause: new AggregateError(
              [error, recoveryError],
              'Project creation and target recovery both failed',
            ),
            code: 'CREATE_RECOVERY_FAILED',
            details: { backupPath, targetDir },
          },
        )
      }

      throw error
    }
  }

  /**
   * 解析项目目标并确保写入操作不会逃逸工作目录
   *
   * @remarks
   * 对尚不存在的路径解析最近存在父目录的真实位置，从而识别父目录中的符号链接
   *
   * @param projectName - 相对工作目录的项目名称
   * @returns 通过边界校验的目标绝对路径
   * @throws {@link AppError} 项目名为空、指向工作目录本身或解析到工作目录外时抛出
   */
  private async _resolveTargetDir(projectName: string): Promise<string> {
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
        {
          code: 'CREATE_INVALID_PROJECT_NAME',
          details: { cwd, projectName, targetDir },
        },
      )
    }

    const [canonicalCwd, canonicalTarget] = await Promise.all([
      resolveProspectiveCanonicalPath(cwd),
      resolveProspectiveCanonicalPath(targetDir),
    ])

    if (!isSameOrDescendant(canonicalCwd, canonicalTarget)) {
      throw new AppError(
        `Invalid project name ${chalk.cyan(projectName)}: resolved target directory must be inside ${chalk.cyan(canonicalCwd)}.`,
        {
          code: 'CREATE_INVALID_PROJECT_NAME',
          details: {
            canonicalCwd,
            canonicalTarget,
            projectName,
            targetDir,
          },
        },
      )
    }

    return targetDir
  }

  /**
   * 解析模版
   */
  private async _resolveTemplate(): Promise<boolean> {
    this._throwIfAborted('resolve-template')

    if (isString(this._template)) {
      // 处理本地模版
      if (this._template.startsWith('.') || path.isAbsolute(this._template)) {
        const templateRootPath = path.resolve(this.cwd, this._template)

        if (!(await isDirectory(templateRootPath))) {
          throw new AppError(
            `Invalid local template ${chalk.cyan(this._template)}.`,
            {
              code: 'CREATE_INVALID_TEMPLATE',
              details: { template: this._template, templateRootPath },
            },
          )
        }

        this._templateRootPath = templateRootPath
        this._isLocal = true
        return true
      }

      if (isGitTemplateSource(this._template)) {
        this._template = {
          type: 'git',
          value: this._template,
        }
      } else {
        // 处理 node_modules
        try {
          const cwd = resolve.sync(this._template, {
            basedir: this.cwd,
          })

          this._templateRootPath = (await findUp(
            async directory => {
              const exist = await pathExists(
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

      this._throwIfAborted('confirm-template')
    }

    const downloadOptions: TemplateDownloadOptions = {
      ...this._template,
      cwd: this.cwd,
      ...(this.constructorOptions.signal
        ? { signal: this.constructorOptions.signal }
        : {}),
    }
    if (this.constructorOptions.allowTemplateScripts !== undefined) {
      downloadOptions.allowScripts =
        this.constructorOptions.allowTemplateScripts
    }

    const download = new TemplateDownloader(downloadOptions)
    this._templateRootPath = await download.download()
    this._throwIfAborted('download-template')
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
      throw new AppError(`Template root path has not been resolved.`, {
        code: 'CREATE_INVALID_TEMPLATE',
      })
    }

    return this._templateRootPath
  }

  /**
   * 在创建流程边界将取消信号转换为应用错误
   *
   * @param operation - 当前创建操作
   * @throws {@link AppError} 调用方已经取消时抛出
   */
  private _throwIfAborted(operation: string): void {
    const signal = this.constructorOptions.signal

    if (signal?.aborted) {
      throw new AppError(`Create operation \`${operation}\` was aborted.`, {
        cause: signal.reason,
        code: 'CREATE_OPERATION_ABORTED',
        details: { operation },
      })
    }
  }
}

/**
 * 判断字符串模版是否应按 Git 仓库解析
 *
 * @remarks
 * URL 和 SCP 风格地址优先于 Node 模块解析，避免把 Git 地址误当成 npm 包名；
 * 普通包名仍交给本地模块解析并在失败后回退到 npm 下载
 *
 * @param source - CLI 或 API 传入的字符串模版声明
 * @returns 是否为支持的 Git 仓库地址
 */
function isGitTemplateSource(source: string): boolean {
  return (
    /^(?:git\+)?(?:https?|ssh|git):\/\//iu.test(source) ||
    /^[\w.-]+@[\w.-]+:.+/u.test(source)
  )
}

/**
 * 拒绝本地模版与目标目录相同或相互嵌套
 *
 * @remarks
 * 覆盖和生成流程会移动或写入目标目录；若两个路径重叠，生成过程可能移动模版
 * 自身或在递归拷贝时不断读取刚生成的文件。对已存在路径优先使用真实路径以识别
 * 符号链接指向的重叠位置
 *
 * @param templateRootPath - 本地模版根目录
 * @param targetDir - 项目输出目录
 * @throws {@link AppError} 两个目录相同或任一目录包含另一个目录时抛出
 */
async function assertPathsDoNotOverlap(
  templateRootPath: string,
  targetDir: string,
): Promise<void> {
  const [templatePath, targetPath] = await Promise.all([
    resolveProspectiveCanonicalPath(templateRootPath),
    resolveProspectiveCanonicalPath(targetDir),
  ])

  if (
    isSameOrDescendant(templatePath, targetPath) ||
    isSameOrDescendant(targetPath, templatePath)
  ) {
    throw new AppError(
      `Local template ${chalk.cyan(templateRootPath)} and target ${chalk.cyan(targetDir)} must not overlap.`,
      {
        code: 'CREATE_INVALID_TEMPLATE',
        details: { targetDir, templateRootPath },
      },
    )
  }
}

function isSameOrDescendant(parent: string, candidate: string): boolean {
  const relativePath = path.relative(parent, candidate)

  return (
    !relativePath ||
    (!relativePath.startsWith(`..${path.sep}`) &&
      relativePath !== '..' &&
      !path.isAbsolute(relativePath))
  )
}
