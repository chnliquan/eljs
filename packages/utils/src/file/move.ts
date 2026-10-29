import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'

function overlaps(from: string, to: string): boolean {
  const relative = path.relative(from, to)
  return (
    relative === '' ||
    (relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  )
}

function validatePaths(from: string, to: string): void {
  if (overlaps(from, to) || overlaps(to, from)) {
    throw new Error(
      'Source and destination paths must not be the same or overlap',
    )
  }
}

/**
 * 解析目录项的位置，仅跟随父目录中的符号链接
 * @remarks rename 操作末级目录项而非链接目标；父目录必须存在，校验不提供并发隔离
 */
async function resolveEntryPath(file: string): Promise<string> {
  return path.join(await fsp.realpath(path.dirname(file)), path.basename(file))
}

/**
 * 同步解析目录项位置，保留末级符号链接自身的移动语义
 */
function resolveEntryPathSync(file: string): string {
  return path.join(fs.realpathSync(path.dirname(file)), path.basename(file))
}

function validateDestination(
  source: fs.Stats,
  destination: fs.Stats | undefined,
  to: string,
  overwrite?: boolean,
): void {
  if (
    destination &&
    source.dev === destination.dev &&
    source.ino === destination.ino
  ) {
    throw new Error('Source and destination refer to the same file')
  }
  if (destination && !overwrite) {
    throw new Error(`The dest ${to} already exists.`)
  }
}

function canReplaceDirectory(
  error: unknown,
  source: fs.Stats,
  destination: fs.Stats | undefined,
  overwrite?: boolean,
): boolean {
  const code = (error as NodeJS.ErrnoException).code
  return !!(
    overwrite &&
    source.isDirectory() &&
    destination?.isDirectory() &&
    (code === 'ENOTEMPTY' || code === 'EEXIST')
  )
}

/**
 * 非空目录替换兼容流程：先暂存旧目标，发布失败则恢复，发布成功后才删除旧目标
 * @remarks 恢复失败时保留备份并在错误中报告位置；此流程不具备崩溃或并发隔离保证
 */
async function replaceDirectory(from: string, to: string): Promise<void> {
  const temporary = await fsp.mkdtemp(
    path.join(path.dirname(to), '.eljs-move-'),
  )
  const backup = path.join(temporary, 'destination')
  let backedUp = false
  try {
    await fsp.rename(to, backup)
    backedUp = true
    await fsp.rename(from, to)
  } catch (error) {
    if (backedUp) {
      try {
        await fsp.rename(backup, to)
      } catch (restoreError) {
        throw new AggregateError(
          [error, restoreError],
          `Move failed and destination restore failed; backup preserved at ${backup}`,
          { cause: restoreError },
        )
      }
    }
    try {
      await fsp.rmdir(temporary)
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        `Move failed and temporary directory cleanup failed: ${temporary}`,
        { cause: cleanupError },
      )
    }
    throw error
  }
  await fsp.rm(temporary, { recursive: true })
}

/**
 * 同步执行非空目录替换，发布失败时恢复旧目标，恢复失败时保留备份
 * @remarks 与异步流程相同，不具备崩溃或并发隔离保证
 */
function replaceDirectorySync(from: string, to: string): void {
  const temporary = fs.mkdtempSync(path.join(path.dirname(to), '.eljs-move-'))
  const backup = path.join(temporary, 'destination')
  let backedUp = false
  try {
    fs.renameSync(to, backup)
    backedUp = true
    fs.renameSync(from, to)
  } catch (error) {
    if (backedUp) {
      try {
        fs.renameSync(backup, to)
      } catch (restoreError) {
        throw new AggregateError(
          [error, restoreError],
          `Move failed and destination restore failed; backup preserved at ${backup}`,
          { cause: restoreError },
        )
      }
    }
    try {
      fs.rmdirSync(temporary)
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        `Move failed and temporary directory cleanup failed: ${temporary}`,
        { cause: cleanupError },
      )
    }
    throw error
  }
  fs.rmSync(temporary, { recursive: true })
}

/**
 * 移动文件或目录，修改前拒绝相同、别名及互相包含的路径
 * @remarks 优先原生重命名，不预先删除目标；非空目录通过临时备份替换，发布失败则恢复，恢复失败时报告保留的备份位置
 * 非空目录替换不具备原子性或崩溃恢复保证；跨设备移动（EXDEV）直接抛出，不回退到复制删除
 * 禁止覆盖时通过 lstat 检查目标，悬空符号链接也视为存在；检查与重命名不是原子操作，无法阻止并发创建或路径替换
 * 移动末级符号链接本身，不跟随它指向的目标
 * @param from - 源路径
 * @param to - 目标路径
 * @param overwrite - 是否覆盖
 * @throws 校验、重命名或备份清理失败时抛出错误；成功替换后的清理失败不会撤回新目标
 */
export async function move(
  from: string,
  to: string,
  overwrite?: boolean,
): Promise<void> {
  from = path.resolve(from)
  to = path.resolve(to)
  const source = await fsp.lstat(from)
  validatePaths(from, to)
  validatePaths(await resolveEntryPath(from), await resolveEntryPath(to))
  let destination: fs.Stats | undefined
  try {
    destination = await fsp.lstat(to)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }
  validateDestination(source, destination, to, overwrite)
  try {
    await fsp.rename(from, to)
  } catch (error) {
    if (!canReplaceDirectory(error, source, destination, overwrite)) {
      throw error
    }
    await replaceDirectory(from, to)
  }
}

/**
 * 同步移动文件或目录，修改前拒绝相同、别名及互相包含的路径
 * @remarks 优先原生重命名，不预先删除目标；非空目录通过临时备份替换，发布失败则恢复，恢复失败时报告保留的备份位置
 * 非空目录替换不具备原子性或崩溃恢复保证；跨设备移动（EXDEV）直接抛出，不回退到复制删除
 * 禁止覆盖时通过 lstat 检查目标，悬空符号链接也视为存在；检查与重命名不是原子操作，无法阻止并发创建或路径替换
 * 移动末级符号链接本身，不跟随它指向的目标
 * @param from - 源路径
 * @param to - 目标路径
 * @param overwrite - 是否覆盖
 * @throws 校验、重命名或备份清理失败时抛出错误；成功替换后的清理失败不会撤回新目标
 */
export function moveSync(from: string, to: string, overwrite?: boolean): void {
  from = path.resolve(from)
  to = path.resolve(to)
  const source = fs.lstatSync(from)
  validatePaths(from, to)
  validatePaths(resolveEntryPathSync(from), resolveEntryPathSync(to))
  let destination: fs.Stats | undefined
  try {
    destination = fs.lstatSync(to)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }
  validateDestination(source, destination, to, overwrite)
  try {
    fs.renameSync(from, to)
  } catch (error) {
    if (!canReplaceDirectory(error, source, destination, overwrite)) {
      throw error
    }
    replaceDirectorySync(from, to)
  }
}
