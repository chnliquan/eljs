import { run } from '@eljs/utils/cp'
import { readJson, remove } from '@eljs/utils/file'
import { downloadGitRepository } from '@eljs/utils/git'
import { chalk } from '@eljs/utils/logger'
import { findUp } from '@eljs/utils/module'
import {
  downloadNpmTarball,
  getNpmPackage,
  getNpmRequestConfig,
  pkgNameAnalysis,
} from '@eljs/utils/npm'
import type { PackageJson } from '@eljs/utils/types'
import path from 'node:path'
import ora, { type Ora } from 'ora'

import type { RemoteTemplate } from '../types'
import { AppError } from '../utils'

/** npm 模版压缩包允许的最大下载体积 */
const MAX_TEMPLATE_TARBALL_BYTES = 100 * 1024 * 1024

/** npm 模版归档允许的最大文件与目录条目数 */
const MAX_TEMPLATE_TARBALL_ENTRIES = 20_000

/** npm 模版归档允许的最大解压后体积 */
const MAX_TEMPLATE_UNPACKED_BYTES = 500 * 1024 * 1024

/**
 * 下载构造函数
 */
export interface TemplateDownloadOptions extends RemoteTemplate {
  /**
   * 当前工作目录
   */
  cwd?: string
  /**
   * 用于取消下载和依赖安装子进程的信号
   */
  signal?: AbortSignal
  /**
   * 是否允许模版依赖在准备阶段执行生命周期脚本
   *
   * @remarks
   * 默认关闭，避免远程模版在项目生成前执行未受信任代码
   *
   * @defaultValue false
   */
  allowScripts?: boolean
}

/**
 * 下载远程模版并按安全策略准备生产依赖
 */
export class TemplateDownloader {
  /**
   * 构造函数选项
   */
  public readonly constructorOptions: Readonly<TemplateDownloadOptions>
  /**
   * spinner
   */
  private readonly _spinner: Ora

  /**
   * 创建远程模版下载器
   *
   * @param options - 模版来源和依赖安装选项
   */
  public constructor(options: TemplateDownloadOptions) {
    this.constructorOptions = Object.freeze({ ...options })
    this._spinner = ora()
  }

  /**
   * 下载并准备远程模版
   *
   * @returns 可供生成器读取的模版根目录
   */
  public async download(): Promise<string> {
    const { type, value, registry } = this.constructorOptions

    switch (type) {
      case 'npm':
        return this._downloadNpmTarball(value, registry)
      case 'git':
        return this._downloadGit(value)
      default:
        throw new AppError(
          `TemplateDownloader type must be \`npm\` or \`git\`, but got \`${type}\`.`,
          {
            code: 'CREATE_INVALID_TEMPLATE',
            details: { type },
          },
        )
    }
  }

  /**
   * 下载 npm 压缩包
   * @param name - 包名
   * @param registry - 仓库源
   */
  private async _downloadNpmTarball(
    name: string,
    registry?: string,
  ): Promise<string> {
    const { name: pkgName, version } = pkgNameAnalysis(name)
    let data: Awaited<ReturnType<typeof getNpmPackage>>

    try {
      data = await getNpmPackage(pkgName, {
        cwd: this.constructorOptions.cwd,
        version,
        registry,
        signal: this.constructorOptions.signal,
      })
    } catch (error) {
      throw toTemplateError(
        error,
        `Access ${pkgName}${version ? `@${version}` : ''} failed`,
        'CREATE_TEMPLATE_DOWNLOAD_FAILED',
        this.constructorOptions.signal,
      )
    }

    if (!data) {
      throw new AppError(
        `Access ${pkgName}${version ? `@${version}` : ''} failed.`,
        {
          code: 'CREATE_TEMPLATE_DOWNLOAD_FAILED',
          details: { packageName: pkgName, version },
        },
      )
    }

    const projectName = chalk.cyan(`${pkgName}@${data.version}`)
    let templateRootPath: string

    try {
      this._spinner.start(`Downloading ${projectName}`)
      const { integrity, shasum, tarball } = data.dist
      if (
        data.dist.unpackedSize !== undefined &&
        data.dist.unpackedSize > MAX_TEMPLATE_UNPACKED_BYTES
      ) {
        throw new AppError(
          `Template ${projectName} expands beyond the ${MAX_TEMPLATE_UNPACKED_BYTES} byte limit`,
          {
            code: 'CREATE_TEMPLATE_DOWNLOAD_FAILED',
            details: {
              maxUnpackedBytes: MAX_TEMPLATE_UNPACKED_BYTES,
              unpackedSize: data.dist.unpackedSize,
            },
          },
        )
      }
      const requestConfig = await getNpmRequestConfig(
        tarball,
        this.constructorOptions.cwd,
      )
      templateRootPath = await downloadNpmTarball(tarball, {
        ...requestConfig,
        integrity: integrity || convertShasumToIntegrity(shasum),
        maxBytes: MAX_TEMPLATE_TARBALL_BYTES,
        maxEntries: MAX_TEMPLATE_TARBALL_ENTRIES,
        maxUnpackedBytes: MAX_TEMPLATE_UNPACKED_BYTES,
        ...(this.constructorOptions.signal
          ? { signal: this.constructorOptions.signal }
          : {}),
      })
      this._spinner.succeed()
    } catch (error) {
      this._spinner.fail()
      throw toTemplateError(
        error,
        `TemplateDownloader ${projectName} failed`,
        'CREATE_TEMPLATE_DOWNLOAD_FAILED',
        this.constructorOptions.signal,
      )
    }

    try {
      await this._installDependencies(templateRootPath, projectName)
    } catch (error) {
      await cleanupFailedTemplate(templateRootPath, projectName, error)
    }
    return templateRootPath
  }

  /**
   * 下载 git
   * @param url - git url
   */
  private async _downloadGit(url: string): Promise<string> {
    let templateRootPath: string

    try {
      this._spinner.start(`Downloading ${url}`)
      const gitOptions = {
        ...(this.constructorOptions.signal
          ? { signal: this.constructorOptions.signal }
          : {}),
      }
      templateRootPath = Object.keys(gitOptions).length
        ? await downloadGitRepository(url, gitOptions)
        : await downloadGitRepository(url)
      this._spinner.succeed()
    } catch (error) {
      this._spinner.fail()
      throw toTemplateError(
        error,
        `TemplateDownloader ${url} failed`,
        'CREATE_TEMPLATE_DOWNLOAD_FAILED',
        this.constructorOptions.signal,
      )
    }

    try {
      await this._installDependencies(templateRootPath, url)
    } catch (error) {
      await cleanupFailedTemplate(path.dirname(templateRootPath), url, error)
    }
    return templateRootPath
  }

  /**
   * 安装依赖
   * @param cwd - 当前工作目录
   * @param projectName - 项目名称
   */
  private async _installDependencies(
    cwd: string,
    projectName: string,
  ): Promise<void> {
    try {
      const { dependencies }: PackageJson =
        (await readJson(path.join(cwd, './package.json'))) || {}

      if (dependencies && Object.keys(dependencies).length > 0) {
        this._spinner.start(`Installing ${projectName}`)
        const installArgs = ['install', '--omit=dev']
        if (!this.constructorOptions.allowScripts) {
          installArgs.push('--ignore-scripts')
        }

        const callerNpmConfig = await findUp('.npmrc', {
          cwd: this.constructorOptions.cwd ?? process.cwd(),
        })
        await run('npm', installArgs, {
          cwd,
          ...(callerNpmConfig
            ? { env: { NPM_CONFIG_USERCONFIG: callerNpmConfig } }
            : {}),
          ...(this.constructorOptions.signal
            ? { signal: this.constructorOptions.signal }
            : {}),
        })
        this._spinner.succeed()
      }
    } catch (error) {
      this._spinner.fail()
      throw toTemplateError(
        error,
        `Install dependencies in ${projectName} failed`,
        'CREATE_TEMPLATE_PREPARATION_FAILED',
        this.constructorOptions.signal,
      )
    }
  }
}

/**
 * 将 npm 旧版 SHA-1 摘要转换为标准 Subresource Integrity 表达式
 *
 * @remarks
 * 仅接受固定长度的十六进制摘要，无效或缺失值不会被当作完整性凭据
 *
 * @param shasum - npm 元数据中的 SHA-1 十六进制摘要
 * @returns 可交给下载层验证的完整性表达式，无效输入返回 `undefined`
 * @internal
 */
function convertShasumToIntegrity(
  shasum: string | undefined,
): string | undefined {
  if (!shasum || !/^[\da-f]{40}$/iu.test(shasum)) {
    return undefined
  }

  return `sha1-${Buffer.from(shasum, 'hex').toString('base64')}`
}

/**
 * 清理未能完成依赖准备的临时模版目录并保留原始错误
 *
 * @param templateRootPath - 由下载器拥有的临时目录
 * @param projectName - 用于诊断的模版标识
 * @param error - 依赖准备阶段的原始错误
 * @throws 原始错误，或清理也失败时包含两者的聚合错误
 */
async function cleanupFailedTemplate(
  templateRootPath: string,
  projectName: string,
  error: unknown,
): Promise<never> {
  try {
    await remove(templateRootPath)
  } catch (cleanupError) {
    throw new AppError(
      `Preparing ${projectName} failed and temporary directory cleanup also failed`,
      {
        cause: new AggregateError([error, cleanupError]),
        code: 'CREATE_CLEANUP_FAILED',
        details: { templateRootPath },
      },
    )
  }

  throw error
}

/**
 * 将下载器依赖抛出的异常转换为稳定的 create 领域错误
 *
 * @param error - 原始异常
 * @param prefix - 当前阶段的诊断前缀
 * @param fallbackCode - 非领域错误使用的默认错误码
 * @param signal - 可选取消信号
 * @returns 带原始 cause、错误码和安全信息的新异常
 * @internal
 */
function toTemplateError(
  error: unknown,
  prefix: string,
  fallbackCode:
    'CREATE_TEMPLATE_DOWNLOAD_FAILED' | 'CREATE_TEMPLATE_PREPARATION_FAILED',
  signal?: AbortSignal,
): AppError {
  const message = error instanceof Error ? error.message : String(error)
  const code = signal?.aborted
    ? 'CREATE_OPERATION_ABORTED'
    : error instanceof AppError
      ? error.code
      : fallbackCode

  return new AppError(`${prefix}: ${message}`, {
    cause: error,
    code,
    details: error instanceof AppError ? error.details : undefined,
  })
}
