import { statSync } from 'node:fs'
import { stat } from 'node:fs/promises'

import { ConfigErrorCode, ConfigLoadError } from './errors'

function isMissingPathError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error.code === 'ENOENT' || error.code === 'ENOTDIR')
  )
}

function createAccessError(
  configFile: string,
  cause: unknown,
): ConfigLoadError {
  const message = cause instanceof Error ? cause.message : String(cause)

  return new ConfigLoadError(`Access config ${configFile} failed: ${message}`, {
    cause,
    code: ConfigErrorCode.FileAccessFailed,
    configFile,
  })
}

/**
 * 判断配置路径是否为可加载的普通文件并保留权限错误
 *
 * @remarks
 * 只有普通文件可参与加载，目录等其他路径类型会被跳过；`ENOENT` 和 `ENOTDIR` 被视为候选不存在，其余文件系统错误必须终止加载
 *
 * @internal
 */
export async function isConfigPathAvailable(
  configFile: string,
): Promise<boolean> {
  try {
    const status = await stat(configFile)
    return status.isFile()
  } catch (error) {
    if (isMissingPathError(error)) {
      return false
    }

    throw createAccessError(configFile, error)
  }
}

/**
 * 同步判断配置路径是否为可加载的普通文件并保留权限错误
 *
 * @remarks
 * 只有普通文件可参与加载，目录等其他路径类型会被跳过；`ENOENT` 和 `ENOTDIR` 被视为候选不存在，其余文件系统错误必须终止加载
 *
 * @internal
 */
export function isConfigPathAvailableSync(configFile: string): boolean {
  try {
    return statSync(configFile).isFile()
  } catch (error) {
    if (isMissingPathError(error)) {
      return false
    }

    throw createAccessError(configFile, error)
  }
}
