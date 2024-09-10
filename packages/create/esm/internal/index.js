export default (function () {
  return {
    plugins: [require.resolve("./register"), require.resolve("./features/app-data"), require.resolve("./features/built-in"), require.resolve("./features/generator"), require.resolve("./features/git-init"), require.resolve("./features/prompts"), require.resolve("./features/questions"), require.resolve("./features/render")]
  };
});