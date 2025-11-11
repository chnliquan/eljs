// Example plugin for testing purposes
export default function examplePlugin(api: any, options: any = {}) {
  api.describe({
    key: 'example-plugin',
    enable: options.enable !== false
  })

  api.register('onStart', async () => {
    console.log('Example plugin started')
  })

  api.register('addEntries', () => {
    return options.entries || ['example-entry.js']
  })

  api.register('modifyConfig', (config: any) => {
    return {
      ...config,
      example: {
        enabled: true,
        options
      }
    }
  })

  if (options.customMethod) {
    api.registerMethod('exampleMethod', () => {
      return 'example result'
    })
  }
}
