// 劫持 require 逻辑，模版在 `require('@eljs/create')` 就可以拿到当前的 NPM 包
import './require-hook'
export { Create } from '@/core'
export * from './define'
export * from './types'
