import { logger, resolve } from '@eljs/utils'
import { join } from 'path'

function getGenConfig(configFile: string) {
  try {
    return require(configFile)
  } catch (error) {
    return {}
  }
}

export function getPresetsAndPlugins(cwd: string) {
  const config = getGenConfig(join(cwd, 'gen.json'))

  function get(type: 'presets' | 'plugins') {
    const value = config[type]

    if (Array.isArray(value)) {
      return value
        .map((item: string) => {
          try {
            return resolve.sync(item, {
              basedir: cwd,
              extensions: ['.tsx', '.ts', '.mjs', '.jsx', '.js'],
            })
          } catch (err: any) {
            logger.error(err.message)
          }
        })
        .filter(Boolean) as string[]
    }

    return [] as string[]
  }

  return { presets: get('presets'), plugins: get('plugins') }
}
