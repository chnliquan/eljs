import { describe, expect, it } from 'vitest'

import {
  createPackageManifest,
  createTsconfigFiles,
} from '../internal/create-package'

describe('package:create 生成逻辑', () => {
  it('应该生成标准的双模块包入口', () => {
    const manifest = createPackageManifest({
      name: '@eljs/example',
      version: '1.2.3',
      dirname: 'packages/example',
      shortName: 'example',
    })

    expect(manifest).toMatchObject({
      name: '@eljs/example',
      version: '1.2.3',
      type: 'module',
      main: './dist/index.cjs',
      module: './dist/index.js',
      types: './dist/index.d.ts',
      files: ['dist'],
      engines: {
        node: '>=22.14.0',
      },
    })
    expect(manifest.exports).toMatchObject({
      '.': {
        import: {
          types: './dist/index.d.ts',
          default: './dist/index.js',
        },
        require: {
          types: './dist/index.d.cts',
          default: './dist/index.cjs',
        },
      },
    })
  })

  it('force 更新时应该保留包专属元数据，包括 false 值', () => {
    const manifest = createPackageManifest({
      name: '@eljs/example',
      version: '2.0.0',
      dirname: 'packages/example',
      shortName: 'example',
      existingPackageJson: {
        name: '@eljs/old-name',
        version: '1.0.0',
        sideEffects: false,
        bin: {
          example: './dist/cli.js',
        },
        optionalDependencies: {
          optional: '^1.0.0',
        },
        peerDependenciesMeta: {
          typescript: {
            optional: true,
          },
        },
        publishConfig: {
          access: 'public',
          registry: 'https://registry.npmjs.org',
        },
      },
    })

    expect(manifest.name).toBe('@eljs/example')
    expect(manifest.version).toBe('2.0.0')
    expect(manifest.sideEffects).toBe(false)
    expect(manifest.bin).toEqual({
      example: './dist/cli.js',
    })
    expect(manifest.optionalDependencies).toEqual({
      optional: '^1.0.0',
    })
    expect(manifest.peerDependenciesMeta).toEqual({
      typescript: {
        optional: true,
      },
    })
    expect(manifest.publishConfig).toEqual({
      access: 'public',
      registry: 'https://registry.npmjs.org',
    })
  })

  it('构建 tsconfig 应该只以 src 为声明文件根目录', () => {
    const files = createTsconfigFiles()
    const buildConfig = JSON.parse(files['tsconfig.build.json'])
    const developmentConfig = JSON.parse(files['tsconfig.json'])

    expect(buildConfig.compilerOptions.rootDir).toBe('src')
    expect(buildConfig.include).toEqual(['src'])
    expect(developmentConfig.include).toEqual(['src', '__tests__'])
  })
})
