import { execa } from 'execa'

const cache = new Map()

/**
 * 命令是否全局安装
 * @param bin 全局命令
 */
export function hasGlobalInstallation(bin: string): Promise<boolean> {
  const cacheKey = `has_global_${bin}`

  if (cache.has(cacheKey)) {
    return Promise.resolve(cache.get(cacheKey))
  }

  return execa(bin, ['--version'])
    .then(data => {
      return /^\d+.\d+.\d+$/.test(data.stdout)
    })
    .then(value => {
      cache.set(cacheKey, value)
      return value
    })
    .catch(() => false)
}
