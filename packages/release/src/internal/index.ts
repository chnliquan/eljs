export function resolveInternalModule(request: string): string {
  const candidates = [
    `${request}.js`,
    `${request}.ts`,
    `${request}/index.js`,
    `${request}/index.ts`,
  ]

  for (const candidate of candidates) {
    try {
      return require.resolve(candidate)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'MODULE_NOT_FOUND') {
        throw error
      }
    }
  }

  return require.resolve(request)
}

export default () => {
  return {
    plugins: [
      resolveInternalModule('./register'),
      resolveInternalModule('./plugins/bootstrap'),
      resolveInternalModule('./plugins/git'),
      resolveInternalModule('./plugins/npm'),
      resolveInternalModule('./plugins/version'),
      resolveInternalModule('./plugins/github'),
    ],
  }
}
