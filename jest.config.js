const path = require('path')
const tsconfig = require(path.join(__dirname, './tsconfig.base.json'))

// https://jestjs.io/docs/configuration
module.exports = {
  testEnvironment: 'node',
  rootDir: __dirname,
  preset: 'ts-jest',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          ...tsconfig.compilerOptions,
          sourceMap: true,
          inlineSourceMap: false,
          verbatimModuleSyntax: false,
          noUnusedLocals: false,
        },
        useESM: false,
        isolatedModules: false,
      },
    ],
  },
  coverageDirectory: 'coverage',
  coverageReporters: ['html', 'lcov', 'text', 'text-summary'],
  collectCoverageFrom: [
    'packages/*/src/**/*.ts',
    '!packages/*/.fatherrc.ts',
    '!packages/*/src/**/cli.ts',
    '!packages/*/src/**/*.d.ts',
    '!packages/*/src/**/*.spec.ts',
    '!packages/*/src/**/*.test.ts',
  ],
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/.git/',
    '/.jest-cache/',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  moduleNameMapper: {
    '^@eljs/(.*?)$': '<rootDir>/packages/$1/src',
  },
  testMatch: ['<rootDir>/packages/**/__tests__/**/*spec.[jt]s?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/examples/__tests__'],
  verbose: true,
  detectOpenHandles: true,
  forceExit: false,
  maxWorkers: '50%',
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  errorOnDeprecated: true,
  testTimeout: 10000,
  clearMocks: true,
  restoreMocks: true,
  // 改善错误堆栈跟踪
  collectCoverageFrom: [
    'packages/*/src/**/*.ts',
    '!packages/*/src/**/*.d.ts',
    '!packages/*/src/**/*.spec.ts',
    '!packages/*/src/**/*.test.ts',
  ],
  // 启用更详细的错误信息
  bail: false,
  // 改善source map支持
  extensionsToTreatAsEsm: [],
}
