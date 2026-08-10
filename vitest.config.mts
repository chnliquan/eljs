import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

const repoRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root: repoRoot,
  cacheDir: path.join(repoRoot, '.vitest-cache'),
  resolve: {
    alias: [
      {
        find: /^@eljs\/([^/]+)\/(.+)$/,
        replacement: path.join(repoRoot, 'packages/$1/src/$2'),
      },
      {
        find: /^@eljs\/(.+)$/,
        replacement: path.join(repoRoot, 'packages/$1/src'),
      },
    ],
  },
  test: {
    environment: 'node',
    include: [
      'packages/**/__tests__/**/*.spec.{ts,tsx}',
      'scripts/**/__tests__/**/*.spec.ts',
    ],
    exclude: ['**/node_modules/**', '**/examples/__tests__/**'],
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 10_000,
    hookTimeout: 10_000,
    pool: 'forks',
    fileParallelism: true,
    maxWorkers: '50%',
    coverage: {
      provider: 'v8',
      reportsDirectory: path.join(repoRoot, 'coverage'),
      reporter: ['html', 'lcov', 'text', 'text-summary'],
      include: ['packages/*/src/**/*.ts'],
      exclude: [
        'packages/*/src/**/cli.ts',
        'packages/*/src/**/*.d.ts',
        'packages/*/src/**/*.spec.ts',
        'packages/*/src/**/*.test.ts',
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
        'packages/create/src/core/project-creator.ts': {
          branches: 85,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        'packages/plugin-host/src/core/**.ts': {
          branches: 90,
          functions: 95,
          lines: 95,
          statements: 95,
        },
        'packages/utils/src/http/**.ts': {
          branches: 85,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      },
    },
  },
})
