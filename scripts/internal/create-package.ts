import type { PackageJson } from '@eljs/utils'

const preservedPackageFields = [
  'description',
  'keywords',
  'author',
  'bin',
  'type',
  'sideEffects',
  'main',
  'module',
  'types',
  'exports',
  'files',
  'engines',
  'scripts',
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
  'peerDependenciesMeta',
  'publishConfig',
] as const

export interface CreatePackageManifestOptions {
  name: string
  version: string
  dirname: string
  shortName: string
  existingPackageJson?: PackageJson
}

export function createPackageManifest({
  name,
  version,
  dirname,
  shortName,
  existingPackageJson,
}: CreatePackageManifestOptions): PackageJson {
  const manifest: PackageJson = {
    name,
    version,
    description: name,
    keywords: ['eljs', shortName],
    homepage: `https://github.com/chnliquan/eljs/tree/master/${dirname}#readme`,
    bugs: {
      url: 'https://github.com/chnliquan/eljs/issues',
    },
    repository: {
      type: 'git',
      url: 'https://github.com/chnliquan/eljs.git',
      directory: dirname,
    },
    license: 'MIT',
    author: 'chnliquan',
    type: 'module',
    main: './dist/index.cjs',
    module: './dist/index.js',
    types: './dist/index.d.ts',
    exports: {
      '.': {
        import: {
          types: './dist/index.d.ts',
          default: './dist/index.js',
        },
        require: {
          types: './dist/index.d.cts',
          default: './dist/index.cjs',
        },
        default: './dist/index.js',
      },
      './package.json': './package.json',
    },
    files: ['dist'],
    engines: {
      node: '>=22.14.0',
    },
    scripts: {
      build: 'rslib build',
      clean: 'rimraf dist',
      dev: 'rslib build --watch',
      typecheck: 'tsc --noEmit && tsc --noEmit -p tsconfig.build.json',
    },
  }

  if (!existingPackageJson) {
    return manifest
  }

  for (const field of preservedPackageFields) {
    const value = existingPackageJson[field]

    if (value !== undefined) {
      Object.assign(manifest, { [field]: value })
    }
  }

  return manifest
}

export function createTsconfigFiles(): Record<
  'tsconfig.json' | 'tsconfig.build.json',
  string
> {
  return {
    'tsconfig.json':
      `
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "declaration": false,
    "declarationMap": false,
    "noEmit": true,
    "noUnusedLocals": false,
    "types": ["node"],
    "verbatimModuleSyntax": false
  },
  "include": ["src", "__tests__"]
}
`.trim() + '\n',
    'tsconfig.build.json':
      `
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "declarationMap": false,
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src"]
}
`.trim() + '\n',
  }
}
