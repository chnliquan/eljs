declare const __DEV__: boolean
declare const __TEST__: boolean
declare const __GLOBAL__: boolean

declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test'
  }
}
