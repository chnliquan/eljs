import eslint from '@eslint/js'
import tseslint from '@typescript-eslint/eslint-plugin'
import eslintConfigPrettier from 'eslint-config-prettier/flat'
import checkFile from 'eslint-plugin-check-file'
import tsdoc from 'eslint-plugin-tsdoc'
import { defineConfig, globalIgnores, type Config } from 'eslint/config'
import { fileURLToPath } from 'node:url'

const packageSourceFiles = ['packages/*/src/**/*.{ts,tsx}']

// 主入口 d.ts 未声明 configs['flat/*']（运行时为 Config 数组），显式断言以保持类型可迭代
const flatRecommended = tseslint.configs[
  'flat/recommended'
] as unknown as Config[]

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/lib/**',
    '**/esm/**',
    'coverage/**',
    '.turbo/**',
    '.vitest-cache/**',
    '.package-smoke-*/**',
    '**/*.d.ts',
  ]),
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [eslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        module: 'readonly',
        require: 'readonly',
        URL: 'readonly',
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [eslint.configs.recommended, ...flatRecommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      'no-redeclare': 'off',
      'no-undef': 'off',
      '@typescript-eslint/explicit-member-accessibility': 'error',
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'variableLike',
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },
        {
          selector: ['memberLike', 'property', 'method'],
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
          leadingUnderscore: 'require',
          modifiers: ['private'],
        },
      ],
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrors: 'none',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: packageSourceFiles,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: fileURLToPath(new URL('.', import.meta.url)),
      },
    },
    rules: {
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-for-in-array': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
  {
    files: packageSourceFiles,
    plugins: {
      tsdoc,
    },
    rules: {
      'tsdoc/syntax': 'error',
    },
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    plugins: {
      'check-file': checkFile,
    },
    rules: {
      'check-file/folder-naming-convention': [
        'error',
        {
          '**/': 'KEBAB_CASE',
        },
        {
          ignoreWords: ['__tests__'],
        },
      ],
      'check-file/filename-naming-convention': [
        'error',
        {
          '**/*.{js,mjs,cjs,ts,tsx}': 'KEBAB_CASE',
        },
        {
          ignoreMiddleExtensions: true,
        },
      ],
    },
  },
  eslintConfigPrettier,
])
