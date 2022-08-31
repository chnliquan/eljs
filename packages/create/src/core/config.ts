import { existsSync, logger, resolve } from '@eljs/utils'
import { join } from 'path'

function getGenConfig(configFile: string) {
  try {
    return require(configFile)
  } catch (error) {
    return {}
  }
}

export function isGenConfigExist(cwd: string) {
  return existsSync(join(cwd, 'gen.json'))
}

export function getPresetsAndPlugins(cwd: string) {
  const config = getGenConfig(join(cwd, 'gen.json'))

  function get(type: 'presets' | 'plugins') {
    const value = config[type]

    if (Array.isArray(value)) {
      return value
        .map((item: string) => {
          try {
            if (item.startsWith('./')) {
              return join(cwd, item)
            }

            return resolve.sync(item, {
              basedir: cwd,
              extensions: ['.tsx', '.ts', '.mjs', '.jsx', '.js'],
            })
          } catch (err) {
            console.log('item', item)
            logger.error((err as Error).message)
          }
        })
        .filter(Boolean) as string[]
    }

    return [] as string[]
  }

  return { presets: get('presets'), plugins: get('plugins') }
}
