export default () => ({
  plugins: [
    require.resolve('./register'),
    require.resolve('./plugins/bootstrap'),
    require.resolve('./plugins/git'),
    require.resolve('./plugins/npm'),
    require.resolve('./plugins/version'),
    require.resolve('./plugins/github'),
  ],
})
