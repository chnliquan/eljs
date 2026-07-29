import { defineConfig } from 'father'

// Father currently selects the declaration tsconfig through this environment
// variable. Keep the build-only project separate from the IDE/test project.
process.env.FATHER_TSCONFIG_NAME ??= 'tsconfig.build.json'

export default defineConfig({
  cjs: {
    output: 'lib',
  },
  esm: {
    output: 'esm',
  },
})
