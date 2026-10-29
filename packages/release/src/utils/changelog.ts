import concat from 'concat-stream'
import type {
  ConventionalChangelog,
  FinalizedContext,
  Preset,
} from 'conventional-changelog'
import { spawn } from 'node:child_process'
import type { Readable, Writable } from 'node:stream'

/**
 * 更新日志生成选项
 */
export interface GenerateChangelogOptions {
  /**
   * 当前工作目录
   */
  cwd?: string
  /**
   * 是否生成独立 tag
   */
  independent?: boolean
  /**
   * conventional-changelog 预设
   *
   * {@link https://github.com/conventional-changelog/conventional-changelog/blob/master/packages/conventional-changelog/README.md#presets}
   */
  preset?: string
  /**
   * 取消初始化和生成，预取消时不启动 Git 子进程
   *
   * @remarks
   * 取消后等待已启动的 Git 子进程关闭，再以原始取消原因拒绝
   */
  signal?: AbortSignal
}

/**
 * 获取更新日志
 *
 * @param options - 更新日志生成选项
 * @returns 去除首尾空白后的更新日志
 * @throws 当预设加载、Git 历史读取或流处理失败时抛出
 * @throws 收到取消信号时抛出原始取消原因，包括非 Error 值
 */
export async function getChangelog(
  options: GenerateChangelogOptions,
): Promise<string> {
  const { cwd = process.cwd(), independent = false, preset, signal } = options
  signal?.throwIfAborted()

  return new Promise((resolve, reject) => {
    const controller = new AbortController()
    const children = new Set<Promise<void>>()
    let stream: Readable | undefined
    let sink: Writable | undefined
    let settled = false

    const finish = (failed: boolean, value: unknown) => {
      if (settled) {
        return
      }
      settled = true
      signal?.removeEventListener('abort', onAbort)
      if (failed) {
        // 只给子进程传标准取消原因，调用方仍收到原始 reason，包括 TimeoutError 和非 Error 值
        controller.abort()
        stream?.unpipe(sink)
        stream?.destroy()
        sink?.destroy()
      }
      // 拒绝前确认 Git 已退出，防止回滚文件时仍有历史读取进程占用仓库
      void Promise.all(children).then(() => {
        if (failed) {
          reject(value)
        } else {
          resolve(value as string)
        }
      })
    }
    const onAbort = () => finish(true, signal?.reason)
    const onError = (error: Error) => finish(true, error)
    const onStreamClose = () => {
      stream?.removeListener('error', onError)
      stream?.removeListener('close', onStreamClose)
      if (!settled) {
        finish(true, new Error('Changelog stream closed before completion'))
      }
    }
    const onSinkClose = () => {
      sink?.removeListener('error', onError)
      sink?.removeListener('close', onSinkClose)
      if (!settled) {
        finish(true, new Error('Changelog output closed before completion'))
      }
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    if (signal?.aborted) {
      onAbort()
    }

    const initialize = async () => {
      const { ConventionalChangelog } = await import('conventional-changelog')
      if (settled) {
        return
      }
      const client = signal
        ? await createAbortableGitClient(cwd, controller.signal, children)
        : cwd
      if (settled) {
        return
      }
      const presetConfig = preset
        ? undefined
        : (await import('@eljs/conventional-changelog-preset')).default()
      if (settled) {
        // 预设初始化可能仍在异步加载，取消后也必须消费其失败
        void presetConfig?.catch(onError)
        return
      }
      const generator = new ConventionalChangelog(client).readPackage()

      if (preset) {
        generator.loadPreset(preset)
      } else if (presetConfig) {
        generator
          .config(presetConfig)
          .context({ commit: 'commit' })
          .writer({ finalizeContext: createFinalizeContext(independent) })

        if (independent) {
          generator.tags({ prefix: /^.+@/ })
        }
      }

      stream = generator.writeStream()
      sink = concat(result => finish(false, result.toString().trim()))
      // 销毁期间异步迭代器仍可能报错，直到 close 才清理错误处理器以吸收晚到错误
      stream.on('error', onError)
      sink.on('error', onError)
      stream.on('close', onStreamClose)
      sink.on('close', onSinkClose)
      stream.pipe(sink)
    }
    void initialize().catch(onError)
  })
}

/**
 * 上游构造器接受的 Git 客户端契约，覆盖执行边界时保留参数格式及 stdout 语义
 */
type ChangelogGitClient = Exclude<
  ConstructorParameters<typeof ConventionalChangelog>[0],
  string | undefined
>

/**
 * 为单次生成注入可取消的 Git 执行边界
 *
 * @remarks
 * 上游 3.1.2 的 exec 和 execStream 未提供 signal，必须在 spawn 处传递
 * 复用固定版本的公开 output 与 outputStream，以保留 stderr 错误和 stdout 契约
 * children 仅保存尚未关闭的子进程，供调用方在拒绝前等待退出
 */
async function createAbortableGitClient(
  cwd: string,
  signal: AbortSignal,
  children: Set<Promise<void>>,
): Promise<ChangelogGitClient> {
  // 显式运行依赖通过公开入口加载，不依赖上游内部目录或 import.meta 转译行为
  const [{ ConventionalGitClient, formatArgs }, { output, outputStream }] =
    await Promise.all([
      import('@conventional-changelog/git-client'),
      import('@simple-libs/child-process-utils'),
    ])
  const client = new ConventionalGitClient(cwd)
  const start = (args: Parameters<ChangelogGitClient['exec']>) => {
    // 上游会捕获部分 Git 错误并重试，预检查确保取消后不会启动重试进程
    signal.throwIfAborted()
    const formattedArgs = formatArgs(...args)
    client.debug?.(formattedArgs)
    const child = spawn('git', formattedArgs, {
      cwd: client.cwd,
      signal,
    })
    const closed = new Promise<void>(resolve => child.once('close', resolve))
    children.add(closed)
    void closed.then(() => children.delete(closed))
    return child
  }
  client.exec = async (...args) => (await output(start(args))).toString().trim()
  client.execStream = (...args) => outputStream(start(args))
  return client
}

/**
 * conventional-changelog 写入器完成上下文时的回调类型
 *
 * @internal
 */
type FinalizeContext = NonNullable<
  NonNullable<Preset['writer']>['finalizeContext']
>

function createFinalizeContext(independent: boolean): FinalizeContext {
  return function finalizeContext(
    context,
    _writerOpts,
    _filteredCommits,
    keyCommit,
    originalCommits,
  ) {
    const changelogContext = context as typeof context & {
      gitSemverTags?: string[]
    }
    const changelogKeyCommit = keyCommit as
      | (NonNullable<typeof keyCommit> & {
          gitTags?: string | null
        })
      | null
    const semverTags = changelogContext.gitSemverTags ?? []
    const firstCommit = originalCommits[0]
    const lastCommit = originalCommits[originalCommits.length - 1]
    const firstCommitHash = firstCommit ? firstCommit.hash : null
    const lastCommitHash = lastCommit ? lastCommit.hash : null

    if (
      (!changelogContext.currentTag || !changelogContext.previousTag) &&
      changelogKeyCommit
    ) {
      const match = /tag:\s*(.+?)[,)]/gi.exec(changelogKeyCommit.gitTags ?? '')
      const currentTag = context.currentTag
      changelogContext.currentTag = currentTag || match?.[1] || null
      const index = changelogContext.currentTag
        ? semverTags.indexOf(changelogContext.currentTag)
        : -1

      // if `keyCommit.gitTags` is not a semver
      if (index === -1) {
        changelogContext.currentTag = currentTag || null
      } else {
        const previousTag = (changelogContext.previousTag =
          semverTags[index + 1])

        if (!previousTag) {
          changelogContext.previousTag =
            changelogContext.previousTag || lastCommitHash
        }
      }
    } else {
      changelogContext.previousTag =
        changelogContext.previousTag || semverTags[0]

      if (changelogContext.version === 'Unreleased') {
        changelogContext.currentTag =
          changelogContext.currentTag || firstCommitHash
      } else if (!changelogContext.currentTag) {
        changelogContext.currentTag = guessNextTag(
          changelogContext,
          independent,
        )
      }
    }

    if (
      typeof changelogContext.linkCompare !== 'boolean' &&
      changelogContext.previousTag &&
      changelogContext.currentTag
    ) {
      changelogContext.linkCompare = true
    }

    return changelogContext
  }
}

function guessNextTag(
  context: Pick<FinalizedContext, 'previousTag' | 'version'>,
  independent = false,
): string | null {
  const { previousTag, version } = context

  if (!version) {
    return null
  }

  if (independent && previousTag) {
    return previousTag.replace(
      /(\d+\.\d+\.\d+)/,
      version[0] === 'v' ? version.slice(1) : version,
    )
  }

  if (previousTag) {
    if (previousTag[0] === 'v' && version[0] !== 'v') {
      return 'v' + version
    }

    if (previousTag[0] !== 'v' && version[0] === 'v') {
      return version.replace(/^v/, '')
    }

    return version
  }

  if (version[0] !== 'v') {
    return 'v' + version
  }

  return version
}
