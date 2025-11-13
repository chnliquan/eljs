/* eslint-disable @typescript-eslint/naming-convention */
import type {
  AnyAsyncFunction,
  AnyAsyncGeneratorFunction,
  AnyConstructorFunction,
  AnyFunction,
  AnyGeneratorFunction,
  DistributiveOmit,
  MaybePromise,
  MaybePromiseFunction,
  NoopFunction,
  OmitIndexSignature,
  PackageJson,
  PackageManager,
  RequiredRecursive,
} from '../../src/types'
import { PackageManagerEnum } from '../../src/types'

describe('Types 模块测试', () => {
  describe('Function Types 函数类型', () => {
    test('NoopFunction 应该是无参数无返回值的函数', () => {
      const noopFn: NoopFunction = () => {}
      const noopFn2: NoopFunction = function () {}

      expect(typeof noopFn).toBe('function')
      expect(typeof noopFn2).toBe('function')
      expect(noopFn()).toBeUndefined()
      expect(noopFn2()).toBeUndefined()
    })

    test('AnyFunction 应该接受任意参数并返回任意值', () => {
      const anyFn: AnyFunction = (a: number, b: string) => a + b.length
      const anyFn2: AnyFunction = (...args: unknown[]) => args.length
      const anyFn3: AnyFunction = () => 'hello'

      expect(typeof anyFn).toBe('function')
      expect(typeof anyFn2).toBe('function')
      expect(typeof anyFn3).toBe('function')
      expect(anyFn(1, 'test')).toBe(5)
      expect(anyFn2(1, 2, 3)).toBe(3)
      expect(anyFn3()).toBe('hello')
    })

    test('AnyGeneratorFunction 应该返回生成器', () => {
      const generatorFn: AnyGeneratorFunction = function* (start: number) {
        yield start
        yield start + 1
        yield start + 2
      }

      expect(typeof generatorFn).toBe('function')
      const generator = generatorFn(10)
      expect(generator.next().value).toBe(10)
      expect(generator.next().value).toBe(11)
      expect(generator.next().value).toBe(12)
      expect(generator.next().done).toBe(true)
    })

    test('AnyAsyncFunction 应该返回 Promise', async () => {
      const asyncFn: AnyAsyncFunction = async (value: number) => value * 2
      const asyncFn2: AnyAsyncFunction = async () => 'async result'

      expect(typeof asyncFn).toBe('function')
      expect(typeof asyncFn2).toBe('function')

      await expect(asyncFn(5)).resolves.toBe(10)
      await expect(asyncFn2()).resolves.toBe('async result')
    })

    test('AnyAsyncGeneratorFunction 应该返回异步生成器', async () => {
      const asyncGeneratorFn: AnyAsyncGeneratorFunction = async function* (
        start: number,
      ) {
        yield start
        yield start + 1
        yield start + 2
      }

      expect(typeof asyncGeneratorFn).toBe('function')
      const asyncGenerator = asyncGeneratorFn(20)
      expect((await asyncGenerator.next()).value).toBe(20)
      expect((await asyncGenerator.next()).value).toBe(21)
      expect((await asyncGenerator.next()).value).toBe(22)
      expect((await asyncGenerator.next()).done).toBe(true)
    })

    test('AnyConstructorFunction 应该是构造函数类型', () => {
      class TestClass {
        public constructor(
          public value: string,
          public count: number,
        ) {}
      }

      const ConstructorFn: AnyConstructorFunction = TestClass
      const instance = new ConstructorFn('test', 42)

      expect(typeof ConstructorFn).toBe('function')
      expect(instance).toBeInstanceOf(TestClass)
      expect(instance.value).toBe('test')
      expect(instance.count).toBe(42)
    })
  })

  describe('Object Types 对象类型', () => {
    test('DistributiveOmit 应该分布式地省略属性', () => {
      interface User {
        id: number
        name: string
        email: string
      }

      interface Admin {
        id: number
        name: string
        role: string
        permissions: string[]
      }

      type UserWithoutEmail = DistributiveOmit<User, 'email'>
      type AdminWithoutRole = DistributiveOmit<Admin, 'role'>
      type UnionWithoutId = DistributiveOmit<User | Admin, 'id'>

      const userWithoutEmail: UserWithoutEmail = {
        id: 1,
        name: 'John',
        // email 属性被省略
      }

      const adminWithoutRole: AdminWithoutRole = {
        id: 1,
        name: 'Admin',
        permissions: ['read', 'write'],
        // role 属性被省略
      }

      const unionItem1: UnionWithoutId = {
        name: 'Test',
        email: 'test@example.com',
        // id 属性被省略
      }

      const unionItem2: UnionWithoutId = {
        name: 'Admin',
        role: 'admin',
        permissions: ['all'],
        // id 属性被省略
      }

      expect(userWithoutEmail.id).toBe(1)
      expect(userWithoutEmail.name).toBe('John')
      expect(adminWithoutRole.name).toBe('Admin')
      expect(unionItem1.name).toBe('Test')
      expect(unionItem2.name).toBe('Admin')
    })

    test('OmitIndexSignature 应该移除索引签名', () => {
      interface TestInterface {
        specificProp: string
        anotherProp: number
        [key: string]: unknown // 索引签名
      }

      type WithoutIndex = OmitIndexSignature<TestInterface>

      const obj: WithoutIndex = {
        specificProp: 'test',
        anotherProp: 42,
        // 索引签名被移除，不能添加任意属性
      }

      expect(obj.specificProp).toBe('test')
      expect(obj.anotherProp).toBe(42)
    })

    test('RequiredRecursive 应该递归地将所有属性变为必需', () => {
      interface NestedOptional {
        name?: string
        details?: {
          age?: number
          hobbies?: string[]
          address?: {
            city?: string
            country?: string
          }
        }
      }

      type RequiredNested = RequiredRecursive<NestedOptional>

      const requiredObj: RequiredNested = {
        name: 'John',
        details: {
          age: 25,
          hobbies: ['reading'],
          address: {
            city: 'New York',
            country: 'USA',
          },
        },
      }

      expect(requiredObj.name).toBe('John')
      expect(requiredObj.details.age).toBe(25)
      expect(requiredObj.details.address.city).toBe('New York')
    })

    test('RequiredRecursive 应该保持函数类型不变', () => {
      interface WithFunction {
        callback?: () => string
        asyncCallback?: () => Promise<number>
      }

      type RequiredWithFunction = RequiredRecursive<WithFunction>

      const obj: RequiredWithFunction = {
        callback: () => 'test',
        asyncCallback: async () => 42,
      }

      expect(typeof obj.callback).toBe('function')
      expect(typeof obj.asyncCallback).toBe('function')
      expect(obj.callback()).toBe('test')
    })

    test('RequiredRecursive 应该保持数组类型不变', () => {
      interface WithArrays {
        numbers?: number[]
        nested?: {
          items?: string[]
        }
      }

      type RequiredWithArrays = RequiredRecursive<WithArrays>

      const obj: RequiredWithArrays = {
        numbers: [1, 2, 3],
        nested: {
          items: ['a', 'b'],
        },
      }

      expect(Array.isArray(obj.numbers)).toBe(true)
      expect(Array.isArray(obj.nested.items)).toBe(true)
      expect(obj.numbers).toEqual([1, 2, 3])
      expect(obj.nested.items).toEqual(['a', 'b'])
    })
  })

  describe('Package Types 包管理器类型', () => {
    test('PackageManagerEnum 应该包含所有包管理器', () => {
      expect(PackageManagerEnum.npm).toBe('npm')
      expect(PackageManagerEnum.yarn).toBe('yarn')
      expect(PackageManagerEnum.pnpm).toBe('pnpm')
      expect(PackageManagerEnum.bun).toBe('bun')

      // 测试枚举值
      expect(Object.values(PackageManagerEnum)).toEqual([
        'npm',
        'yarn',
        'pnpm',
        'bun',
      ])
    })

    test('PackageManager 类型应该是包管理器字符串字面量', () => {
      const npmManager: PackageManager = 'npm'
      const yarnManager: PackageManager = 'yarn'
      const pnpmManager: PackageManager = 'pnpm'
      const bunManager: PackageManager = 'bun'

      expect(npmManager).toBe('npm')
      expect(yarnManager).toBe('yarn')
      expect(pnpmManager).toBe('pnpm')
      expect(bunManager).toBe('bun')
    })

    test('PackageJson 应该定义完整的包配置结构', () => {
      const packageJson: PackageJson = {
        name: '@test/package',
        version: '1.0.0',
        private: false,
        description: 'Test package',
        keywords: ['test', 'typescript'],
        homepage: 'https://example.com',
        bugs: {
          url: 'https://github.com/test/package/issues',
        },
        repository: {
          type: 'git',
          url: 'https://github.com/test/package',
        },
        license: 'MIT',
        author: 'Test Author',
        main: 'lib/index.js',
        module: 'esm/index.js',
        browser: 'browser/index.js',
        types: 'types/index.d.ts',
        bin: {
          'my-cli': './bin/cli.js',
        },
        files: ['lib', 'esm', 'types'],
        scripts: {
          build: 'tsc',
          test: 'jest',
        },
        'lint-staged': {
          '*.ts': ['eslint --fix', 'prettier --write'],
        },
        dependencies: {
          lodash: '^4.17.21',
        },
        devDependencies: {
          typescript: '^4.0.0',
          jest: '^27.0.0',
        },
        peerDependencies: {
          react: '^17.0.0',
        },
        publishConfig: {
          registry: 'https://registry.npmjs.org',
          access: 'public',
        },
        engines: {
          node: '>=14.0.0',
          npm: '>=6.0.0',
        },
        workspaces: ['packages/*'],
        customField: 'custom value',
      }

      expect(packageJson.name).toBe('@test/package')
      expect(packageJson.version).toBe('1.0.0')
      expect(packageJson.private).toBe(false)
      expect(packageJson.keywords).toEqual(['test', 'typescript'])
      expect(packageJson.bugs?.url).toBe(
        'https://github.com/test/package/issues',
      )
      expect(packageJson.repository?.type).toBe('git')
      expect(packageJson.bin).toEqual({ 'my-cli': './bin/cli.js' })
      expect(packageJson.workspaces).toEqual(['packages/*'])
      expect(packageJson.customField).toBe('custom value')
    })

    test('PackageJson 应该支持最小配置', () => {
      const minimalPackage: PackageJson = {
        name: 'minimal-package',
        version: '0.0.1',
      }

      expect(minimalPackage.name).toBe('minimal-package')
      expect(minimalPackage.version).toBe('0.0.1')
    })

    test('PackageJson 应该支持 bin 为字符串', () => {
      const packageWithStringBin: PackageJson = {
        name: 'cli-package',
        version: '1.0.0',
        bin: './bin/cli.js',
      }

      expect(packageWithStringBin.bin).toBe('./bin/cli.js')
    })
  })

  describe('Promise Types Promise 类型', () => {
    test('MaybePromise 应该支持 Promise 和非 Promise 值', () => {
      const syncValue: MaybePromise<string> = 'hello'
      const asyncValue: MaybePromise<string> = Promise.resolve('world')

      expect(syncValue).toBe('hello')
      expect(asyncValue).toBeInstanceOf(Promise)

      // 测试 PromiseLike 对象（仅类型检查，不运行时验证）
      const promiseLikeCheck = (value: MaybePromise<number>) => {
        // 这里只是为了测试类型兼容性
        return typeof value
      }

      expect(promiseLikeCheck(42)).toBe('number')
      expect(promiseLikeCheck(Promise.resolve(42))).toBe('object')
    })

    test('MaybePromise 应该在实际使用中工作正常', async () => {
      function getValue(sync: boolean): MaybePromise<string> {
        return sync ? 'sync value' : Promise.resolve('async value')
      }

      const syncResult = getValue(true)
      const asyncResult = getValue(false)

      expect(syncResult).toBe('sync value')
      await expect(asyncResult).resolves.toBe('async value')
    })

    test('MaybePromiseFunction 应该支持同步和异步函数', async () => {
      const syncFunction: MaybePromiseFunction<string> = (name: string) =>
        `Hello, ${name}!`
      const asyncFunction: MaybePromiseFunction<string> = async (
        name: string,
      ) => `Hello, ${name}!`
      const promiseLikeFunction: MaybePromiseFunction<number> = (x: number) =>
        Promise.resolve(x * 2)

      expect(syncFunction('World')).toBe('Hello, World!')
      await expect(asyncFunction('Async')).resolves.toBe('Hello, Async!')
      await expect(promiseLikeFunction(5)).resolves.toBe(10)
    })

    test('MaybePromiseFunction 应该支持多个参数', () => {
      const multiArgFunction: MaybePromiseFunction<string> = (
        greeting: string,
        name: string,
        punctuation = '!',
      ) => `${greeting}, ${name}${punctuation}`

      const asyncMultiArgFunction: MaybePromiseFunction<number> = async (
        a: number,
        b: number,
        c: number,
      ) => a + b + c

      expect(multiArgFunction('Hi', 'John')).toBe('Hi, John!')
      expect(multiArgFunction('Hello', 'Jane', '?')).toBe('Hello, Jane?')
      expect(asyncMultiArgFunction(1, 2, 3)).toBeInstanceOf(Promise)
    })
  })

  describe('类型兼容性测试', () => {
    test('类型应该正确分配', () => {
      // 测试函数类型的兼容性
      const testFn: AnyFunction = () => 'test'
      const noopTestFn: NoopFunction = () => {}

      expect(typeof testFn).toBe('function')
      expect(typeof noopTestFn).toBe('function')
    })

    test('枚举应该与字符串类型兼容', () => {
      function usePackageManager(pm: PackageManager) {
        return `Using ${pm}`
      }

      expect(usePackageManager(PackageManagerEnum.npm)).toBe('Using npm')
      expect(usePackageManager('yarn')).toBe('Using yarn')
    })

    test('复杂嵌套类型应该正常工作', () => {
      interface DeepNestedOptional {
        level1?: {
          level2?: {
            level3?: {
              value?: string
              callback?: () => void
            }
          }
          array?: number[]
        }
        functions?: {
          sync?: () => string
          async?: () => Promise<string>
          generator?: () => Generator<number>
        }
      }

      type DeepRequired = RequiredRecursive<DeepNestedOptional>

      const deepObj: DeepRequired = {
        level1: {
          level2: {
            level3: {
              value: 'deep value',
              callback: () => {},
            },
          },
          array: [1, 2, 3],
        },
        functions: {
          sync: () => 'sync',
          async: async () => 'async',
          generator: function* () {
            yield 1
          },
        },
      }

      expect(deepObj.level1.level2.level3.value).toBe('deep value')
      expect(typeof deepObj.level1.level2.level3.callback).toBe('function')
      expect(Array.isArray(deepObj.level1.array)).toBe(true)
      expect(typeof deepObj.functions.sync).toBe('function')
      expect(typeof deepObj.functions.async).toBe('function')
      expect(typeof deepObj.functions.generator).toBe('function')
    })

    test('联合类型应该正确处理', () => {
      interface TypeA {
        type: 'A'
        valueA: string
        common?: string
      }

      interface TypeB {
        type: 'B'
        valueB: number
        common?: string
      }

      type UnionType = TypeA | TypeB
      type UnionWithoutCommon = DistributiveOmit<UnionType, 'common'>

      const objA: UnionWithoutCommon = {
        type: 'A',
        valueA: 'test',
      }

      const objB: UnionWithoutCommon = {
        type: 'B',
        valueB: 42,
      }

      expect(objA.type).toBe('A')
      expect(objB.type).toBe('B')
      expect('valueA' in objA).toBe(true)
      expect('valueB' in objB).toBe(true)
    })

    test('索引签名移除应该精确工作', () => {
      interface WithComplexIndex {
        [key: string]: unknown
        [key: number]: string
        specificString: string
        specificNumber: number
        specificBoolean: boolean
      }

      type WithoutIndex = OmitIndexSignature<WithComplexIndex>

      const obj: WithoutIndex = {
        specificString: 'test',
        specificNumber: 42,
        specificBoolean: true,
      }

      expect(obj.specificString).toBe('test')
      expect(obj.specificNumber).toBe(42)
      expect(obj.specificBoolean).toBe(true)
    })

    test('MaybePromise 在复杂场景中应该工作', () => {
      async function processValues<T>(values: MaybePromise<T>[]): Promise<T[]> {
        const results: T[] = []
        for (const value of values) {
          if (value && typeof value === 'object' && 'then' in value) {
            results.push(await value)
          } else {
            results.push(value)
          }
        }
        return results
      }

      const mixedValues: MaybePromise<number>[] = [
        1,
        Promise.resolve(2),
        3,
        Promise.resolve(4),
      ]

      return processValues(mixedValues).then(results => {
        expect(results).toEqual([1, 2, 3, 4])
      })
    })

    test('函数类型应该在运行时正常工作', async () => {
      // 测试生成器函数
      const generator: AnyGeneratorFunction = function* (start: number) {
        yield start
        yield start + 1
        return start + 2
      }

      const gen = generator(10)
      expect(gen.next().value).toBe(10)
      expect(gen.next().value).toBe(11)
      expect(gen.next().value).toBe(12)

      // 测试异步生成器函数
      const asyncGenerator: AnyAsyncGeneratorFunction = async function* (
        start: number,
      ) {
        yield start
        yield start + 1
        return start + 2
      }

      const asyncGen = asyncGenerator(20)
      expect((await asyncGen.next()).value).toBe(20)
      expect((await asyncGen.next()).value).toBe(21)
      expect((await asyncGen.next()).value).toBe(22)
    })

    test('PackageJson 的复杂配置应该工作', () => {
      const complexPackageJson: PackageJson = {
        name: '@scope/complex-package',
        version: '2.1.0-beta.1',
        private: true,
        description: 'A complex package configuration',
        keywords: ['complex', 'test', 'typescript', 'monorepo'],
        homepage: 'https://github.com/scope/complex-package#readme',
        bugs: {
          url: 'https://github.com/scope/complex-package/issues',
        },
        repository: {
          type: 'git',
          url: 'https://github.com/scope/complex-package.git',
        },
        license: 'MIT',
        author: 'Test Author <test@example.com>',
        main: './lib/index.js',
        module: './esm/index.js',
        browser: './browser/index.js',
        types: './types/index.d.ts',
        bin: {
          'complex-cli': './bin/cli.js',
          'complex-dev': './bin/dev.js',
        },
        files: ['lib', 'esm', 'browser', 'types', 'bin'],
        scripts: {
          build: 'npm run clean && npm run compile',
          clean: 'rimraf lib esm browser types',
          compile: 'tsc && tsc -p tsconfig.esm.json',
          test: 'jest',
          'test:watch': 'jest --watch',
          'test:coverage': 'jest --coverage',
          lint: 'eslint src --ext .ts',
          'lint:fix': 'eslint src --ext .ts --fix',
          format: 'prettier --write src/**/*.ts',
          dev: 'nodemon --exec ts-node src/index.ts',
          prepublishOnly: 'npm run build && npm run test',
        },
        'lint-staged': {
          '*.ts': ['eslint --fix', 'prettier --write'],
          '*.{json,md}': ['prettier --write'],
        },
        dependencies: {
          lodash: '^4.17.21',
          'core-js': '^3.25.0',
          tslib: '^2.4.0',
        },
        devDependencies: {
          '@types/node': '^18.0.0',
          '@types/jest': '^29.0.0',
          '@types/lodash': '^4.14.0',
          typescript: '^4.8.0',
          jest: '^29.0.0',
          'ts-jest': '^29.0.0',
          eslint: '^8.0.0',
          prettier: '^2.7.0',
          nodemon: '^2.0.0',
          'ts-node': '^10.0.0',
          rimraf: '^3.0.0',
        },
        peerDependencies: {
          react: '>=16.8.0',
          'react-dom': '>=16.8.0',
        },
        publishConfig: {
          registry: 'https://npm.pkg.github.com',
          access: 'restricted',
        },
        engines: {
          node: '>=16.0.0',
          npm: '>=8.0.0',
          yarn: '>=1.22.0',
        },
        workspaces: ['packages/*', 'apps/*', 'tools/*'],
        // 自定义字段
        customConfig: {
          buildTarget: 'es2020',
          enableSourceMaps: true,
        },
        contributors: [
          'Contributor One <contrib1@example.com>',
          'Contributor Two <contrib2@example.com>',
        ],
        funding: {
          type: 'github',
          url: 'https://github.com/sponsors/scope',
        },
      }

      // 验证基础字段
      expect(complexPackageJson.name).toBe('@scope/complex-package')
      expect(complexPackageJson.version).toBe('2.1.0-beta.1')
      expect(complexPackageJson.private).toBe(true)

      // 验证复杂字段
      expect(complexPackageJson.bin).toEqual({
        'complex-cli': './bin/cli.js',
        'complex-dev': './bin/dev.js',
      })
      expect(complexPackageJson.workspaces).toEqual([
        'packages/*',
        'apps/*',
        'tools/*',
      ])

      // 验证自定义字段
      expect(complexPackageJson.customConfig).toEqual({
        buildTarget: 'es2020',
        enableSourceMaps: true,
      })
      expect(Array.isArray(complexPackageJson.contributors)).toBe(true)
    })
  })
})
