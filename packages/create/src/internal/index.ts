export default () => ({
  plugins: [
    require.resolve('./register'),
    require.resolve('./features/app-data'),
    require.resolve('./features/built-in'),
    require.resolve('./features/generator'),
    require.resolve('./features/prompts'),
    require.resolve('./features/questions'),
    require.resolve('./features/render'),
  ],
})
