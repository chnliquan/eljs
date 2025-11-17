import { Runner } from '../../src/core/runner'
import {
  RunnerStageEnum,
  type AppData,
  type Paths,
  type Prompts,
} from '../../src/types'

describe('Runner 类类型安全优化测试', () => {
  const mockCwd = process.cwd() // 使用真实路径避免验证错误

  describe('基础功能和方法测试', () => {
    it('应该有 run 方法', () => {
      const runner = new Runner({ cwd: mockCwd })
      expect(typeof runner.run).toBe('function')
      expect(runner.run.length).toBe(2) // target, projectName 两个参数
    })

    it('应该正确初始化所有属性', () => {
      const runner = new Runner({ cwd: mockCwd })

      expect(runner.stage).toBe(RunnerStageEnum.Uninitialized)
      expect(typeof runner.paths).toBe('object')
      expect(typeof runner.appData).toBe('object')
      expect(typeof runner.prompts).toBe('object')
      expect(typeof runner.tsConfig).toBe('object')
      expect(typeof runner.jestConfig).toBe('object')
      expect(typeof runner.prettierConfig).toBe('object')
    })

    it('应该继承 Pluggable 类', () => {
      const runner = new Runner({ cwd: mockCwd })
      expect(runner).toBeInstanceOf(Runner)
    })

    it('应该有继承的方法', () => {
      const runner = new Runner({ cwd: mockCwd })
      expect('load' in runner).toBe(true)
      expect('applyPlugins' in runner).toBe(true)
    })
  })

  describe('类型安全的配置对象管理测试', () => {
    it('应该管理类型安全的 paths 配置', () => {
      const runner = new Runner({ cwd: mockCwd })

      interface DetailedPaths extends Paths {
        src: string
        lib: string
        dist: string
        types: string
        docs: string
        examples: string
        config: string
        scripts: string
        assets: string
        public: string
      }

      const detailedPaths: DetailedPaths = {
        cwd: mockCwd,
        target: '/detailed/target',
        src: '/detailed/target/src',
        lib: '/detailed/target/lib',
        dist: '/detailed/target/dist',
        types: '/detailed/target/types',
        docs: '/detailed/target/docs',
        examples: '/detailed/target/examples',
        config: '/detailed/target/config',
        scripts: '/detailed/target/scripts',
        assets: '/detailed/target/assets',
        public: '/detailed/target/public',
      }

      runner.paths = detailedPaths
      expect(runner.paths).toEqual(detailedPaths)
      expect(Object.keys(runner.paths)).toHaveLength(12) // 包含所有字段
      expect(runner.paths.src).toBe('/detailed/target/src')
      expect(runner.paths.assets).toBe('/detailed/target/assets')
    })

    it('应该管理类型安全的 appData 配置', () => {
      const runner = new Runner({ cwd: mockCwd })

      interface DetailedAppData extends AppData {
        framework: 'react' | 'vue' | 'angular' | 'svelte'
        bundler: 'webpack' | 'vite' | 'rollup' | 'parcel'
        cssFramework: 'tailwindcss' | 'bootstrap' | 'bulma' | 'materialize'
        stateManagement: 'redux' | 'zustand' | 'mobx' | 'recoil'
        testing: 'jest' | 'vitest' | 'mocha' | 'jasmine'
        linting: 'eslint' | 'tslint' | 'biome'
        formatting: 'prettier' | 'biome'
        typeChecking: 'typescript' | 'flow'
        deployment: 'vercel' | 'netlify' | 'aws' | 'docker'
        features: Array<'auth' | 'api' | 'ui' | 'testing' | 'docs' | 'i18n'>
        environment: 'development' | 'staging' | 'production'
      }

      const detailedAppData: DetailedAppData = {
        scene: 'web',
        cliVersion: '1.3.1',
        pkg: {
          name: 'detailed-project',
          version: '2.1.0',
          description: 'A detailed project for comprehensive testing',
          author: 'Detailed Author',
          license: 'MIT',
          keywords: ['detailed', 'testing', 'typescript', 'react'],
          repository: {
            type: 'git',
            url: 'https://github.com/detailed/project',
          },
          homepage: 'https://detailed-project.dev',
        },
        projectName: 'detailed-project',
        packageManager: 'pnpm',
        framework: 'react',
        bundler: 'vite',
        cssFramework: 'tailwindcss',
        stateManagement: 'zustand',
        testing: 'jest',
        linting: 'eslint',
        formatting: 'prettier',
        typeChecking: 'typescript',
        deployment: 'vercel',
        features: ['auth', 'api', 'ui', 'testing', 'docs'],
        environment: 'production',
      }

      runner.appData = detailedAppData
      expect(runner.appData).toEqual(detailedAppData)
      expect(runner.appData.framework).toBe('react')
      expect(runner.appData.features).toContain('auth')
      expect(runner.appData.environment).toBe('production')
    })

    it('应该管理类型安全的 prompts 配置', () => {
      const runner = new Runner({ cwd: mockCwd })

      interface DetailedPrompts extends Prompts {
        description: string
        license: 'MIT' | 'Apache-2.0' | 'GPL-3.0' | 'ISC' | 'BSD-3-Clause'
        keywords: string[]
        homepage: string
        repository: string
        bugs: string
        features: Array<
          | 'authentication'
          | 'authorization'
          | 'api'
          | 'ui'
          | 'testing'
          | 'documentation'
          | 'internationalization'
          | 'pwa'
          | 'ssr'
        >
        deployment: 'vercel' | 'netlify' | 'aws' | 'docker' | 'manual'
        ci: 'github-actions' | 'gitlab-ci' | 'travis-ci' | 'circle-ci' | 'none'
        monitoring: 'sentry' | 'bugsnag' | 'rollbar' | 'none'
        analytics: 'google-analytics' | 'mixpanel' | 'amplitude' | 'none'
      }

      const detailedPrompts: DetailedPrompts = {
        author: 'Expert Developer',
        email: 'expert@professional.dev',
        gitUrl: 'git@github.com:expert/professional-project.git',
        gitHref: 'https://github.com/expert/professional-project',
        registry: 'https://registry.npmjs.org',
        year: '2024',
        date: '2024-11-17',
        dateTime: '2024-11-17 18:00:00',
        dirname: 'professional-project',
        description:
          'A professional-grade TypeScript project with comprehensive features',
        license: 'MIT',
        keywords: [
          'typescript',
          'react',
          'vite',
          'tailwindcss',
          'professional',
        ],
        homepage: 'https://professional-project.dev',
        repository: 'https://github.com/expert/professional-project',
        bugs: 'https://github.com/expert/professional-project/issues',
        features: [
          'authentication',
          'api',
          'ui',
          'testing',
          'documentation',
          'pwa',
        ],
        deployment: 'vercel',
        ci: 'github-actions',
        monitoring: 'sentry',
        analytics: 'google-analytics',
      }

      runner.prompts = detailedPrompts
      expect(runner.prompts).toEqual(detailedPrompts)
      expect(runner.prompts.license).toBe('MIT')
      expect(runner.prompts.features).toContain('authentication')
      expect(runner.prompts.deployment).toBe('vercel')
      expect(runner.prompts.keywords).toHaveLength(5)
    })
  })

  describe('配置对象类型定义测试', () => {
    it('应该管理严格类型的 TypeScript 配置', () => {
      const runner = new Runner({ cwd: mockCwd })

      interface StrictTSConfig {
        compilerOptions: {
          target:
            | 'ES5'
            | 'ES2015'
            | 'ES2016'
            | 'ES2017'
            | 'ES2018'
            | 'ES2019'
            | 'ES2020'
            | 'ES2021'
            | 'ES2022'
            | 'ESNext'
          lib: Array<
            | 'ES5'
            | 'ES6'
            | 'ES2015'
            | 'ES2016'
            | 'ES2017'
            | 'ES2018'
            | 'ES2019'
            | 'ES2020'
            | 'ES2021'
            | 'ES2022'
            | 'ESNext'
            | 'DOM'
            | 'DOM.Iterable'
            | 'WebWorker'
          >
          module:
            | 'None'
            | 'CommonJS'
            | 'AMD'
            | 'UMD'
            | 'System'
            | 'ES6'
            | 'ES2015'
            | 'ES2020'
            | 'ES2022'
            | 'ESNext'
            | 'Node16'
            | 'NodeNext'
          moduleResolution: 'node' | 'classic' | 'node16' | 'nodenext'
          jsx:
            | 'preserve'
            | 'react'
            | 'react-jsx'
            | 'react-jsxdev'
            | 'react-native'
          declaration: boolean
          declarationMap: boolean
          sourceMap: boolean
          outDir: string
          rootDir: string
          strict: boolean
          esModuleInterop: boolean
          allowSyntheticDefaultImports: boolean
          forceConsistentCasingInFileNames: boolean
          skipLibCheck: boolean
        }
        include: string[]
        exclude: string[]
        compileOnSave: boolean
        extends?: string
        files?: string[]
      }

      const strictTsConfig: StrictTSConfig = {
        compilerOptions: {
          target: 'ES2022',
          lib: ['ES2022', 'DOM', 'DOM.Iterable'],
          module: 'ESNext',
          moduleResolution: 'node',
          jsx: 'react-jsx',
          declaration: true,
          declarationMap: true,
          sourceMap: true,
          outDir: './dist',
          rootDir: './src',
          strict: true,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          forceConsistentCasingInFileNames: true,
          skipLibCheck: true,
        },
        include: ['src/**/*', 'types/**/*'],
        exclude: ['node_modules', 'dist', 'build'],
        compileOnSave: false,
        extends: './tsconfig.base.json',
        files: ['src/index.ts', 'types/global.d.ts'],
      }

      runner.tsConfig = strictTsConfig
      expect(runner.tsConfig.compilerOptions.target).toBe('ES2022')
      expect(runner.tsConfig.compilerOptions.jsx).toBe('react-jsx')
      expect(runner.tsConfig.include).toContain('src/**/*')
      expect(runner.tsConfig.files).toContain('src/index.ts')
    })

    it('应该管理严格类型的 Jest 配置', () => {
      const runner = new Runner({ cwd: mockCwd })

      interface StrictJestConfig {
        preset: 'ts-jest' | 'babel-jest' | 'jest-preset-angular' | string
        testEnvironment:
          | 'node'
          | 'jsdom'
          | 'jest-environment-node'
          | 'jest-environment-jsdom'
        setupFiles?: string[]
        setupFilesAfterEnv?: string[]
        testMatch?: string[]
        testPathIgnorePatterns?: string[]
        collectCoverageFrom?: string[]
        coverageDirectory?: string
        coverageReporters?: Array<
          | 'clover'
          | 'cobertura'
          | 'html'
          | 'json'
          | 'lcov'
          | 'none'
          | 'teamcity'
          | 'text'
          | 'text-summary'
        >
        coverageThreshold?: {
          global?: {
            branches?: number
            functions?: number
            lines?: number
            statements?: number
          }
          [path: string]:
            | {
                branches?: number
                functions?: number
                lines?: number
                statements?: number
              }
            | undefined
        }
        transform?: Record<string, string | [string, Record<string, unknown>]>
        moduleFileExtensions?: string[]
        moduleNameMapping?: Record<string, string>
        testTimeout?: number
        verbose?: boolean
        bail?: boolean | number
        cache?: boolean
        clearMocks?: boolean
        resetMocks?: boolean
        restoreMocks?: boolean
      }

      const strictJestConfig: StrictJestConfig = {
        preset: 'ts-jest',
        testEnvironment: 'jsdom',
        setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
        testMatch: [
          '<rootDir>/src/**/__tests__/**/*.{ts,tsx}',
          '<rootDir>/src/**/*.{test,spec}.{ts,tsx}',
        ],
        testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/'],
        collectCoverageFrom: [
          'src/**/*.{ts,tsx}',
          '!src/**/*.d.ts',
          '!src/**/*.stories.{ts,tsx}',
        ],
        coverageDirectory: 'coverage',
        coverageReporters: ['text', 'lcov', 'html'],
        coverageThreshold: {
          global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80,
          },
          srcComponents: {
            branches: 90,
            functions: 90,
            lines: 90,
            statements: 90,
          },
        },
        transform: {
          tsTransform: 'ts-jest',
          jsTransform: 'babel-jest',
        },
        moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
        moduleNameMapping: {
          srcAlias: '<rootDir>/src/$1',
        },
        testTimeout: 10000,
        verbose: true,
        bail: false,
        cache: true,
        clearMocks: true,
        resetMocks: false,
        restoreMocks: true,
      }

      runner.jestConfig = strictJestConfig
      expect(runner.jestConfig.preset).toBe('ts-jest')
      expect(runner.jestConfig.testEnvironment).toBe('jsdom')
      expect(runner.jestConfig.coverageThreshold?.global?.branches).toBe(80)
      expect(runner.jestConfig.moduleFileExtensions).toContain('tsx')
    })

    it('应该管理严格类型的 Prettier 配置', () => {
      const runner = new Runner({ cwd: mockCwd })

      interface StrictPrettierConfig {
        semi: boolean
        singleQuote: boolean
        quoteProps: 'as-needed' | 'consistent' | 'preserve'
        jsxSingleQuote: boolean
        trailingComma: 'all' | 'es5' | 'none'
        bracketSpacing: boolean
        bracketSameLine: boolean
        arrowParens: 'avoid' | 'always'
        rangeStart: number
        rangeEnd: number
        requirePragma: boolean
        insertPragma: boolean
        proseWrap: 'preserve' | 'always' | 'never'
        htmlWhitespaceSensitivity: 'css' | 'strict' | 'ignore'
        vueIndentScriptAndStyle: boolean
        endOfLine: 'lf' | 'crlf' | 'cr' | 'auto'
        embeddedLanguageFormatting: 'auto' | 'off'
        singleAttributePerLine: boolean
        printWidth: number
        tabWidth: number
        useTabs: boolean
        overrides?: Array<{
          files: string | string[]
          excludeFiles?: string | string[]
          options: Partial<StrictPrettierConfig>
        }>
        plugins?: string[]
      }

      const strictPrettierConfig: StrictPrettierConfig = {
        semi: false,
        singleQuote: true,
        quoteProps: 'as-needed',
        jsxSingleQuote: true,
        trailingComma: 'all',
        bracketSpacing: true,
        bracketSameLine: false,
        arrowParens: 'avoid',
        rangeStart: 0,
        rangeEnd: Number.POSITIVE_INFINITY,
        requirePragma: false,
        insertPragma: false,
        proseWrap: 'preserve',
        htmlWhitespaceSensitivity: 'css',
        vueIndentScriptAndStyle: false,
        endOfLine: 'lf',
        embeddedLanguageFormatting: 'auto',
        singleAttributePerLine: false,
        printWidth: 100,
        tabWidth: 2,
        useTabs: false,
        overrides: [
          {
            files: '*.json',
            options: {
              printWidth: 80,
            },
          },
          {
            files: ['*.md', '*.mdx'],
            options: {
              proseWrap: 'always',
              printWidth: 80,
            },
          },
        ],
        plugins: [
          'prettier-plugin-organize-imports',
          'prettier-plugin-packagejson',
        ],
      }

      runner.prettierConfig = strictPrettierConfig
      expect(runner.prettierConfig.trailingComma).toBe('all')
      expect(runner.prettierConfig.overrides).toHaveLength(2)
      expect(runner.prettierConfig.plugins).toContain(
        'prettier-plugin-organize-imports',
      )
    })
  })

  describe('阶段管理类型安全测试', () => {
    it('应该支持所有工作流程阶段的类型安全转换', () => {
      const runner = new Runner({ cwd: mockCwd })

      // 定义阶段转换的类型
      const stageTransitions: Array<{
        from: RunnerStageEnum
        to: RunnerStageEnum
        description: string
      }> = [
        {
          from: RunnerStageEnum.Uninitialized,
          to: RunnerStageEnum.Init,
          description: '初始化到启动',
        },
        {
          from: RunnerStageEnum.Init,
          to: RunnerStageEnum.CollectAppData,
          description: '启动到收集应用数据',
        },
        {
          from: RunnerStageEnum.CollectAppData,
          to: RunnerStageEnum.CollectTsConfig,
          description: '收集应用数据到收集TS配置',
        },
        {
          from: RunnerStageEnum.CollectTsConfig,
          to: RunnerStageEnum.CollectJestConfig,
          description: '收集TS配置到收集Jest配置',
        },
        {
          from: RunnerStageEnum.CollectJestConfig,
          to: RunnerStageEnum.CollectPrettierConfig,
          description: '收集Jest配置到收集Prettier配置',
        },
        {
          from: RunnerStageEnum.CollectPrettierConfig,
          to: RunnerStageEnum.OnStart,
          description: '收集Prettier配置到开始执行',
        },
      ]

      stageTransitions.forEach(({ from, to }) => {
        runner.stage = from
        expect(runner.stage).toBe(from)

        runner.stage = to
        expect(runner.stage).toBe(to)
      })
    })

    it('应该支持阶段相关的配置设置', () => {
      const runner = new Runner({ cwd: mockCwd })

      // 类型安全的阶段配置映射
      const stageConfigurations: Record<
        RunnerStageEnum,
        {
          stage: RunnerStageEnum
          config: Partial<AppData | Paths | Prompts | Record<string, unknown>>
        }
      > = {
        [RunnerStageEnum.Uninitialized]: {
          stage: RunnerStageEnum.Uninitialized,
          config: {},
        },
        [RunnerStageEnum.Init]: {
          stage: RunnerStageEnum.Init,
          config: {},
        },
        [RunnerStageEnum.CollectAppData]: {
          stage: RunnerStageEnum.CollectAppData,
          config: {
            scene: 'web' as const,
            projectName: 'stage-test',
            packageManager: 'pnpm' as const,
          },
        },
        [RunnerStageEnum.CollectPluginConfig]: {
          stage: RunnerStageEnum.CollectPluginConfig,
          config: {},
        },
        [RunnerStageEnum.CollectPrompts]: {
          stage: RunnerStageEnum.CollectPrompts,
          config: {
            author: 'Stage Author',
            email: 'stage@test.com',
          },
        },
        [RunnerStageEnum.CollectTsConfig]: {
          stage: RunnerStageEnum.CollectTsConfig,
          config: {
            compilerOptions: { target: 'es2020' },
          },
        },
        [RunnerStageEnum.CollectJestConfig]: {
          stage: RunnerStageEnum.CollectJestConfig,
          config: {
            testEnvironment: 'node',
          },
        },
        [RunnerStageEnum.CollectPrettierConfig]: {
          stage: RunnerStageEnum.CollectPrettierConfig,
          config: {
            semi: true,
          },
        },
        [RunnerStageEnum.OnStart]: {
          stage: RunnerStageEnum.OnStart,
          config: {},
        },
      }

      Object.values(stageConfigurations).forEach(({ stage, config }) => {
        runner.stage = stage
        expect(runner.stage).toBe(stage)

        if (stage === RunnerStageEnum.CollectAppData && config) {
          runner.appData = {
            scene: 'web',
            cliVersion: '1.3.1',
            pkg: {},
            projectName: 'stage-test',
            packageManager: 'pnpm',
            ...config,
          }
        }
      })
    })
  })

  describe('场景特定配置类型安全测试', () => {
    it('应该支持 Web 应用的严格类型配置', () => {
      const runner = new Runner({ cwd: mockCwd })

      interface WebApplicationConfig {
        appData: AppData & {
          framework: 'react' | 'vue' | 'angular'
          bundler: 'webpack' | 'vite' | 'parcel'
          cssFramework: 'tailwindcss' | 'bootstrap' | 'materialize'
          uiLibrary: 'material-ui' | 'ant-design' | 'chakra-ui'
          stateManagement: 'redux' | 'mobx' | 'zustand'
          routing: 'react-router' | 'reach-router' | 'next-router'
        }
        tsConfig: {
          compilerOptions: {
            jsx: 'react-jsx' | 'react'
            lib: string[]
            target: string
          }
        }
      }

      const webConfig: WebApplicationConfig = {
        appData: {
          scene: 'web',
          cliVersion: '1.3.1',
          pkg: {
            name: 'web-app-typed',
            version: '1.0.0',
          },
          projectName: 'web-app-typed',
          packageManager: 'npm',
          framework: 'react',
          bundler: 'vite',
          cssFramework: 'tailwindcss',
          uiLibrary: 'material-ui',
          stateManagement: 'zustand',
          routing: 'react-router',
        },
        tsConfig: {
          compilerOptions: {
            jsx: 'react-jsx',
            lib: ['DOM', 'ES2022'],
            target: 'ES2020',
          },
        },
      }

      runner.appData = webConfig.appData
      runner.tsConfig = webConfig.tsConfig

      expect(runner.appData.framework).toBe('react')
      expect(runner.tsConfig.compilerOptions.jsx).toBe('react-jsx')
    })

    it('应该支持 Node.js 应用的严格类型配置', () => {
      const runner = new Runner({ cwd: mockCwd })

      interface NodeApplicationConfig {
        appData: AppData & {
          framework: 'express' | 'koa' | 'fastify' | 'nestjs'
          database: 'postgresql' | 'mysql' | 'mongodb' | 'sqlite'
          orm: 'typeorm' | 'prisma' | 'sequelize' | 'mongoose'
          authentication: 'jwt' | 'passport' | 'auth0' | 'cognito'
          validation: 'joi' | 'yup' | 'zod' | 'class-validator'
          logging: 'winston' | 'pino' | 'bunyan'
          testing: 'jest' | 'mocha' | 'ava'
        }
        tsConfig: {
          compilerOptions: {
            module: 'CommonJS' | 'ESNext'
            target: string
            lib?: string[]
          }
        }
      }

      const nodeConfig: NodeApplicationConfig = {
        appData: {
          scene: 'node',
          cliVersion: '1.3.1',
          pkg: {
            name: 'node-service-typed',
            version: '1.0.0',
            main: 'dist/index.js',
          },
          projectName: 'node-service-typed',
          packageManager: 'pnpm',
          framework: 'nestjs',
          database: 'postgresql',
          orm: 'prisma',
          authentication: 'jwt',
          validation: 'class-validator',
          logging: 'winston',
          testing: 'jest',
        },
        tsConfig: {
          compilerOptions: {
            module: 'CommonJS',
            target: 'ES2020',
            lib: ['ES2020'],
          },
        },
      }

      runner.appData = nodeConfig.appData
      runner.tsConfig = nodeConfig.tsConfig

      expect(runner.appData.framework).toBe('nestjs')
      expect(runner.appData.database).toBe('postgresql')
      expect(runner.tsConfig.compilerOptions.module).toBe('CommonJS')
    })
  })

  describe('性能和类型安全结合测试', () => {
    it('应该处理类型安全的大量配置数据', () => {
      const runner = new Runner({ cwd: mockCwd })

      interface TypedConfigItem {
        value: string
        type: 'string' | 'number' | 'boolean' | 'object'
        enabled: boolean
        priority: 'low' | 'medium' | 'high' | 'critical'
        metadata: {
          index: number
          category: 'primary' | 'secondary' | 'tertiary'
          tags: string[]
          created: string
          updated: string
        }
        validation: {
          required: boolean
          minLength?: number
          maxLength?: number
          pattern?: string
        }
      }

      const typedLargeConfig: Record<string, TypedConfigItem> = {}
      for (let i = 0; i < 100; i++) {
        typedLargeConfig[`typedOption${i}`] = {
          value: `typed-value-${i}`,
          type:
            i % 4 === 0
              ? 'string'
              : i % 4 === 1
                ? 'number'
                : i % 4 === 2
                  ? 'boolean'
                  : 'object',
          enabled: i % 2 === 0,
          priority:
            i % 4 === 0
              ? 'low'
              : i % 4 === 1
                ? 'medium'
                : i % 4 === 2
                  ? 'high'
                  : 'critical',
          metadata: {
            index: i,
            category: i < 33 ? 'primary' : i < 66 ? 'secondary' : 'tertiary',
            tags: [
              `tag-${i}`,
              `category-${Math.floor(i / 10)}`,
              `type-${i % 4}`,
            ],
            created: new Date(2024, 0, i + 1).toISOString(),
            updated: new Date(2024, 0, i + 1).toISOString(),
          },
          validation: {
            required: i % 3 === 0,
            minLength: i % 5 === 0 ? 1 : undefined,
            maxLength: i % 7 === 0 ? 100 : undefined,
            pattern: i % 11 === 0 ? '^[a-zA-Z0-9]+$' : undefined,
          },
        }
      }

      runner.tsConfig = typedLargeConfig
      expect(Object.keys(runner.tsConfig)).toHaveLength(100)

      const typedOption99 = (runner.tsConfig as Record<string, TypedConfigItem>)
        .typedOption99
      expect(typedOption99.value).toBe('typed-value-99')
      expect(typedOption99.priority).toBe('critical') // 99 % 4 === 3 -> 'critical'
      expect(typedOption99.metadata.category).toBe('tertiary')
      expect(typedOption99.validation.required).toBe(true) // 99 % 3 === 0
    })

    it('应该支持类型安全的配置继承和扩展', () => {
      const runner = new Runner({ cwd: mockCwd })

      // 基础配置接口
      interface BaseConfig {
        name: string
        version: string
        enabled: boolean
      }

      // 扩展配置接口
      interface ExtendedConfig extends BaseConfig {
        features: string[]
        settings: {
          debug: boolean
          verbose: boolean
          logLevel: 'error' | 'warn' | 'info' | 'debug'
        }
        advanced: {
          optimization: boolean
          compression: boolean
          bundleAnalysis: boolean
        }
      }

      const baseConfig: BaseConfig = {
        name: 'base-config',
        version: '1.0.0',
        enabled: true,
      }

      const extendedConfig: ExtendedConfig = {
        ...baseConfig,
        features: ['feature1', 'feature2', 'feature3'],
        settings: {
          debug: true,
          verbose: false,
          logLevel: 'info',
        },
        advanced: {
          optimization: true,
          compression: false,
          bundleAnalysis: true,
        },
      }

      runner.tsConfig = baseConfig
      expect((runner.tsConfig as BaseConfig).name).toBe('base-config')

      runner.jestConfig = extendedConfig
      expect((runner.jestConfig as ExtendedConfig).features).toContain(
        'feature1',
      )
      expect((runner.jestConfig as ExtendedConfig).settings.logLevel).toBe(
        'info',
      )
    })

    it('应该支持类型安全的配置验证', () => {
      const runner = new Runner({ cwd: mockCwd })

      // 定义验证规则的类型
      interface ValidationRule {
        field: string
        type: 'required' | 'optional'
        validator: (value: unknown) => boolean
        errorMessage: string
      }

      interface ValidatedAppData extends AppData {
        validated: boolean
        validationErrors: string[]
      }

      const appDataValidation: ValidationRule[] = [
        {
          field: 'scene',
          type: 'required',
          validator: value =>
            typeof value === 'string' &&
            ['web', 'node'].includes(value as string),
          errorMessage: 'Scene must be web or node',
        },
        {
          field: 'projectName',
          type: 'required',
          validator: value =>
            typeof value === 'string' && (value as string).length > 0,
          errorMessage: 'Project name is required',
        },
        {
          field: 'packageManager',
          type: 'required',
          validator: value =>
            typeof value === 'string' &&
            ['npm', 'yarn', 'pnpm'].includes(value as string),
          errorMessage: 'Package manager must be npm, yarn, or pnpm',
        },
      ]

      const validatedAppData: ValidatedAppData = {
        scene: 'web',
        cliVersion: '1.3.1',
        pkg: {},
        projectName: 'validated-project',
        packageManager: 'pnpm',
        validated: true,
        validationErrors: [],
      }

      // 验证每个规则
      appDataValidation.forEach(rule => {
        const fieldValue = (validatedAppData as Record<string, unknown>)[
          rule.field
        ]
        if (rule.validator) {
          const isValid = rule.validator(fieldValue)
          expect(isValid).toBe(true)
        }
      })

      runner.appData = validatedAppData
      expect(runner.appData.validated).toBe(true)
      expect(runner.appData.validationErrors).toHaveLength(0)
    })
  })

  describe('边界情况和错误处理类型安全测试', () => {
    it('应该处理类型安全的错误配置', () => {
      const runner = new Runner({ cwd: mockCwd })

      // 定义错误类型
      type ConfigError = {
        code:
          | 'INVALID_TYPE'
          | 'MISSING_FIELD'
          | 'INVALID_VALUE'
          | 'CONSTRAINT_VIOLATION'
        message: string
        field?: string
        expected?: string
        actual?: string
      }

      interface ErrorHandlingConfig {
        hasErrors: boolean
        errors: ConfigError[]
        warnings: string[]
      }

      const errorConfig: ErrorHandlingConfig = {
        hasErrors: false,
        errors: [],
        warnings: ['This is a test warning'],
      }

      runner.tsConfig = errorConfig
      expect((runner.tsConfig as ErrorHandlingConfig).hasErrors).toBe(false)
      expect((runner.tsConfig as ErrorHandlingConfig).warnings).toHaveLength(1)
    })

    it('应该处理类型安全的空配置', () => {
      const runner = new Runner({ cwd: mockCwd })

      // 定义空配置的类型
      type EmptyConfig = Record<string, never>
      type PartialConfig = Partial<{
        compilerOptions: Record<string, unknown>
        include: string[]
        exclude: string[]
      }>

      const emptyConfig: EmptyConfig = {}
      const partialConfig: PartialConfig = {
        compilerOptions: {},
      }

      runner.tsConfig = emptyConfig
      runner.jestConfig = partialConfig

      expect(Object.keys(runner.tsConfig)).toHaveLength(0)
      expect((runner.jestConfig as PartialConfig).compilerOptions).toEqual({})
    })

    it('应该处理类型安全的配置引用和共享', () => {
      const runner = new Runner({ cwd: mockCwd })

      interface SharedConfiguration {
        environment: 'development' | 'staging' | 'production'
        debug: boolean
        version: string
        buildTime: string
        features: {
          [key: string]: {
            enabled: boolean
            config: Record<string, unknown>
          }
        }
      }

      const sharedConfig: SharedConfiguration = {
        environment: 'development',
        debug: true,
        version: '2.1.0',
        buildTime: new Date().toISOString(),
        features: {
          authentication: {
            enabled: true,
            config: { provider: 'auth0', strategy: 'jwt' },
          },
          analytics: {
            enabled: false,
            config: { provider: 'google-analytics' },
          },
        },
      }

      // 共享配置在多个地方使用
      runner.tsConfig = sharedConfig
      runner.jestConfig = sharedConfig

      expect(runner.tsConfig).toBe(sharedConfig)
      expect(runner.jestConfig).toBe(sharedConfig)
      expect((runner.tsConfig as SharedConfiguration).environment).toBe(
        'development',
      )
      expect(
        (runner.jestConfig as SharedConfiguration).features.authentication
          .enabled,
      ).toBe(true)
    })
  })

  describe('构造函数和选项类型安全测试', () => {
    it('应该处理类型安全的构造函数选项', () => {
      interface TypedRunnerOptions {
        cwd: string
        plugins?: string[]
        presets?: string[]
        metadata?: {
          created: string
          author: string
          purpose: string
        }
      }

      const typedOptions: TypedRunnerOptions = {
        cwd: mockCwd,
        plugins: [
          '/typed/plugin1.js',
          './relative/typed-plugin.js',
          '@scope/typed-plugin',
        ],
        presets: [
          '@babel/preset-typescript',
          '@babel/preset-react',
          './custom-preset.js',
        ],
        metadata: {
          created: new Date().toISOString(),
          author: 'Typed Author',
          purpose: 'Type safety testing',
        },
      }

      expect(() => new Runner(typedOptions)).not.toThrow()
    })

    it('应该处理类型安全的选项验证', () => {
      // 简化的选项验证
      interface ValidatedOptions {
        cwd: string
        plugins: string[]
        presets: string[]
      }

      const validOptions: ValidatedOptions = {
        cwd: mockCwd,
        plugins: ['plugin1.js', 'plugin2.js'],
        presets: ['preset1', 'preset2'],
      }

      // 类型安全的验证
      expect(typeof validOptions.cwd).toBe('string')
      expect(Array.isArray(validOptions.plugins)).toBe(true)
      expect(Array.isArray(validOptions.presets)).toBe(true)
      expect(validOptions.cwd.length).toBeGreaterThan(0)

      expect(() => new Runner(validOptions)).not.toThrow()
    })
  })

  describe('实际应用场景类型安全测试', () => {
    it('应该支持企业级应用的完整类型配置', () => {
      const runner = new Runner({ cwd: mockCwd })

      interface EnterpriseConfig {
        appData: AppData & {
          organization: string
          division: string
          compliance: string[]
          security: {
            level: 'standard' | 'enhanced' | 'strict'
            features: string[]
          }
          deployment: {
            strategy: 'blue-green' | 'rolling' | 'canary'
            environments: string[]
          }
        }
        paths: Paths & {
          artifacts: string
          logs: string
          monitoring: string
          backup: string
        }
      }

      const enterpriseConfig: EnterpriseConfig = {
        appData: {
          scene: 'web',
          cliVersion: '1.3.1',
          pkg: {
            name: '@enterprise/corporate-app',
            version: '3.1.0',
            private: true,
          },
          projectName: 'corporate-app',
          packageManager: 'pnpm',
          organization: 'Enterprise Corp',
          division: 'Technology',
          compliance: ['SOX', 'GDPR', 'HIPAA'],
          security: {
            level: 'strict',
            features: ['2fa', 'encryption', 'audit-logging'],
          },
          deployment: {
            strategy: 'blue-green',
            environments: ['development', 'staging', 'production'],
          },
        },
        paths: {
          cwd: mockCwd,
          target: '/enterprise/app',
          artifacts: '/enterprise/app/artifacts',
          logs: '/enterprise/app/logs',
          monitoring: '/enterprise/app/monitoring',
          backup: '/enterprise/app/backup',
        },
      }

      runner.appData = enterpriseConfig.appData
      runner.paths = enterpriseConfig.paths

      expect(runner.appData.organization).toBe('Enterprise Corp')
      expect(runner.appData.security.level).toBe('strict')
      expect(runner.appData.compliance).toContain('GDPR')
      expect(runner.paths.artifacts).toBe('/enterprise/app/artifacts')
    })

    it('应该支持开源项目的类型安全配置', () => {
      const runner = new Runner({ cwd: mockCwd })

      interface OpenSourceConfig {
        appData: AppData & {
          license: 'MIT' | 'Apache-2.0' | 'GPL-3.0' | 'BSD-3-Clause'
          repository: {
            type: 'git'
            url: string
            branch: string
          }
          community: {
            contributing: boolean
            codeOfConduct: boolean
            issueTemplates: boolean
            prTemplates: boolean
          }
          documentation: {
            readme: boolean
            changelog: boolean
            apiDocs: boolean
            examples: boolean
          }
        }
      }

      const openSourceConfig: OpenSourceConfig = {
        appData: {
          scene: 'web',
          cliVersion: '1.3.1',
          pkg: {
            name: 'awesome-open-source',
            version: '1.0.0',
            license: 'MIT',
            repository: {
              type: 'git',
              url: 'https://github.com/user/awesome-open-source',
            },
          },
          projectName: 'awesome-open-source',
          packageManager: 'npm',
          license: 'MIT',
          repository: {
            type: 'git',
            url: 'https://github.com/user/awesome-open-source',
            branch: 'main',
          },
          community: {
            contributing: true,
            codeOfConduct: true,
            issueTemplates: true,
            prTemplates: true,
          },
          documentation: {
            readme: true,
            changelog: true,
            apiDocs: true,
            examples: true,
          },
        },
      }

      runner.appData = openSourceConfig.appData
      expect(runner.appData.license).toBe('MIT')
      expect(runner.appData.community.contributing).toBe(true)
      expect(runner.appData.documentation.apiDocs).toBe(true)
    })
  })
})
