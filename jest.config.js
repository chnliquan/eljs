// https://jestjs.io/docs/configuration
module.exports = {
  testEnvironment: 'node',
  preset: 'ts-jest',
  rootDir: __dirname,
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        target: 'es2019',
        sourceMap: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        verbatimModuleSyntax: false,
        skipLibCheck: true,
      },
    }],
  },
  coverageDirectory: 'coverage',
  coverageReporters: ['html', 'lcov', 'text'],
  collectCoverageFrom: ['packages/*/src/**/*.ts'],
  watchPathIgnorePatterns: ['/node_modules/', '/dist/', '/.git/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  moduleNameMapper: {
    // 包间导入映射
    '^@eljs/(.*?)$': '<rootDir>/packages/$1/src',
  },
  testMatch: ['<rootDir>/packages/**/__tests__/**/*spec.[jt]s?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/examples/__tests__'],
  globals: {
    __DEV__: true,
    __TEST__: true,
    __VERSION__: require('./package.json').version,
    __GLOBAL__: false,
    __ESM__: true,
    __NODE_JS__: true,
  },
}
