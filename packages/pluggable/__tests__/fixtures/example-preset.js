export default function examplePreset(api: any) {
  api.describe({
    key: 'example-preset'
  })

  // Register nested plugins
  api.registerPlugins([
    'example-plugin',
    ['another-plugin', { preset: true }]
  ])

  return {
    plugins: [
      ['inline-plugin', { fromPreset: true }]
    ]
  }
}
