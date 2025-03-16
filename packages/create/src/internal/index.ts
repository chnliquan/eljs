export default () => {
  return {
    plugins: [
      require.resolve('./register'),
      require.resolve('./plugins/app-data'),
      require.resolve('./plugins/built-in'),
      require.resolve('./plugins/generator'),
      require.resolve('./plugins/git-init'),
      require.resolve('./plugins/prompts'),
      require.resolve('./plugins/questions'),
      require.resolve('./plugins/render'),
    ],
  }
}
