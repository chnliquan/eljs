import { defineConfig } from '@rslib/core'

const sharedLibraryOptions = {
  autoExtension: true,
  bundle: false,
  dts: {
    autoExtension: true,
  },
  redirect: {
    dts: {
      extension: true,
    },
  },
} as const

export default defineConfig({
  lib: [
    {
      ...sharedLibraryOptions,
      id: 'esm',
      format: 'esm',
    },
    {
      ...sharedLibraryOptions,
      id: 'cjs',
      format: 'cjs',
    },
  ],
  output: {
    autoExternal: true,
    cleanDistPath: true,
    distPath: {
      root: 'dist',
    },
    sourceMap: false,
    target: 'node',
  },
  source: {
    entry: {
      index: ['./src/**', '!./src/**/*.d.ts'],
    },
    tsconfigPath: './tsconfig.build.json',
  },
})
