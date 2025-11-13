/* eslint-disable @typescript-eslint/naming-convention */
import {
  isArray,
  isAsyncFunction,
  isBoolean,
  isESModule,
  isFunction,
  isGeneratorFunction,
  isNull,
  isObject,
  isPlainObject,
  isPromise,
  isString,
  isUndefined,
} from '../../src/type'

describe('类型检查工具函数', () => {
  describe('基础类型检查', () => {
    test('isUndefined 检查 undefined', () => {
      expect(isUndefined(undefined)).toBe(true)
      expect(isUndefined(null)).toBe(false)
      expect(isUndefined(0)).toBe(false)
      expect(isUndefined('')).toBe(false)
      expect(isUndefined({})).toBe(false)
      expect(isUndefined([])).toBe(false)
      expect(isUndefined(false)).toBe(false)
    })

    test('isNull 检查 null', () => {
      expect(isNull(null)).toBe(true)
      expect(isNull(undefined)).toBe(false)
      expect(isNull(0)).toBe(false)
      expect(isNull('')).toBe(false)
      expect(isNull({})).toBe(false)
      expect(isNull([])).toBe(false)
      expect(isNull(false)).toBe(false)
    })

    test('isString 检查字符串', () => {
      expect(isString('')).toBe(true)
      expect(isString('hello')).toBe(true)
      expect(isString('0')).toBe(true)
      expect(isString(String(123))).toBe(true)
      expect(isString(0)).toBe(false)
      expect(isString(123)).toBe(false)
      expect(isString(true)).toBe(false)
      expect(isString({})).toBe(false)
      expect(isString([])).toBe(false)
      expect(isString(null)).toBe(false)
      expect(isString(undefined)).toBe(false)
    })

    test('isObject 检查对象', () => {
      expect(isObject({})).toBe(true)
      expect(isObject({ a: 1 })).toBe(true)
      expect(isObject(new Object())).toBe(true)
      expect(isObject(null)).toBe(false)
      expect(isObject(undefined)).toBe(false)
      expect(isObject([])).toBe(false)
      expect(isObject('string')).toBe(false)
      expect(isObject(123)).toBe(false)
      expect(isObject(true)).toBe(false)
      expect(isObject(() => {})).toBe(false)
    })

    test('isArray 检查数组', () => {
      expect(isArray([])).toBe(true)
      expect(isArray([1, 2, 3])).toBe(true)
      expect(isArray([])).toBe(true)
      expect(isArray({})).toBe(false)
      expect(isArray('string')).toBe(false)
      expect(isArray(123)).toBe(false)
      expect(isArray(true)).toBe(false)
      expect(isArray(null)).toBe(false)
      expect(isArray(undefined)).toBe(false)
    })

    test('isFunction 检查函数', () => {
      expect(isFunction(() => {})).toBe(true)
      expect(isFunction(function () {})).toBe(true)
      expect(isFunction(function named() {})).toBe(true)
      expect(isFunction(Math.max)).toBe(true)
      expect(isFunction(Array.isArray)).toBe(true)

      expect(isFunction(async function () {})).toBe(true)
      expect(isFunction(function* generator() {})).toBe(true)

      expect(isFunction({})).toBe(false)
      expect(isFunction([])).toBe(false)
      expect(isFunction('string')).toBe(false)
      expect(isFunction(123)).toBe(false)
      expect(isFunction(true)).toBe(false)
      expect(isFunction(null)).toBe(false)
      expect(isFunction(undefined)).toBe(false)
    })

    test('isBoolean 检查布尔值', () => {
      expect(isBoolean(true)).toBe(true)
      expect(isBoolean(false)).toBe(true)
      expect(isBoolean(Boolean(1))).toBe(true)
      expect(isBoolean(Boolean(0))).toBe(true)
      expect(isBoolean(!!1)).toBe(true)

      expect(isBoolean(1)).toBe(false)
      expect(isBoolean(0)).toBe(false)
      expect(isBoolean('true')).toBe(false)
      expect(isBoolean('false')).toBe(false)
      expect(isBoolean({})).toBe(false)
      expect(isBoolean([])).toBe(false)
      expect(isBoolean(null)).toBe(false)
      expect(isBoolean(undefined)).toBe(false)
    })
  })

  describe('复杂类型检查', () => {
    test('isPlainObject 检查纯对象', () => {
      expect(isPlainObject({})).toBe(true)
      expect(isPlainObject({ a: 1 })).toBe(true)
      expect(isPlainObject(Object.create(null))).toBe(true)
      expect(isPlainObject(new Object())).toBe(true)
      expect(isPlainObject({ constructor: Object })).toBe(true)

      expect(isPlainObject([])).toBe(false)
      expect(isPlainObject(new Date())).toBe(false)
      expect(isPlainObject(new RegExp('test'))).toBe(false)
      expect(isPlainObject(new Error('test'))).toBe(false)
      expect(isPlainObject(() => {})).toBe(false)
      expect(isPlainObject(null)).toBe(false)
      expect(isPlainObject(undefined)).toBe(false)
      expect(isPlainObject('string')).toBe(false)
      expect(isPlainObject(123)).toBe(false)

      class CustomClass {}
      expect(isPlainObject(new CustomClass())).toBe(false)

      // 测试原型链边界情况
      const obj = {}
      expect(isPlainObject(obj)).toBe(true)

      const objWithProto = Object.create({})
      expect(isPlainObject(objWithProto)).toBe(false)
    })

    test('isPromise 检查 Promise', () => {
      expect(isPromise(Promise.resolve())).toBe(true)
      expect(isPromise(Promise.reject().catch(() => {}))).toBe(true)
      expect(isPromise(new Promise(() => {}))).toBe(true)
      expect(isPromise(Promise.all([]))).toBe(true)

      const promiseLike = { then: () => {} }
      expect(isPromise(promiseLike)).toBe(true)

      const promiseLikeWithFunction = { then: function () {} }
      expect(isPromise(promiseLikeWithFunction)).toBe(true)

      expect(isPromise({})).toBe(false)
      expect(isPromise([])).toBe(false)
      expect(isPromise(() => {})).toBe(false)
      expect(isPromise('string')).toBe(false)
      expect(isPromise(123)).toBe(false)

      // 实现特性：返回原始假值
      expect(isPromise(null)).toBe(null)
      expect(isPromise(undefined)).toBe(undefined)
      expect(isPromise(false)).toBe(false)
      expect(isPromise(0)).toBe(0)
      expect(isPromise('')).toBe('')

      const notPromiseLike = { then: 'not a function' }
      expect(isPromise(notPromiseLike)).toBe(false)

      const noThen = { other: 'property' }
      expect(isPromise(noThen)).toBe(false)
    })

    test('isGeneratorFunction 检查生成器函数', () => {
      function* generatorFunction() {
        yield 1
      }
      function* emptyGenerator() {}
      const generatorExpression = function* () {
        yield 2
      }

      expect(isGeneratorFunction(generatorFunction)).toBe(true)
      expect(isGeneratorFunction(emptyGenerator)).toBe(true)
      expect(isGeneratorFunction(generatorExpression)).toBe(true)

      function normalFunction() {}
      const arrowFunction = () => {}
      async function asyncFunction() {}
      const asyncArrow = async () => {}

      expect(isGeneratorFunction(normalFunction)).toBe(false)
      expect(isGeneratorFunction(arrowFunction)).toBe(false)
      expect(isGeneratorFunction(asyncFunction)).toBe(false)
      expect(isGeneratorFunction(asyncArrow)).toBe(false)
      expect(isGeneratorFunction({})).toBe(false)
      expect(isGeneratorFunction(null)).toBe(false)
      expect(isGeneratorFunction(undefined)).toBe(false)
      expect(isGeneratorFunction('string')).toBe(false)
      expect(isGeneratorFunction(123)).toBe(false)
    })

    test('isAsyncFunction 检查异步函数', () => {
      async function asyncFunction() {
        return 'test'
      }
      const asyncArrow = async () => {
        return 'test'
      }
      const asyncExpression = async function () {
        return 'test'
      }

      expect(isAsyncFunction(asyncFunction)).toBe(true)
      expect(isAsyncFunction(asyncArrow)).toBe(true)
      expect(isAsyncFunction(asyncExpression)).toBe(true)

      function normalFunction() {}
      const arrowFunction = () => {}
      function* generatorFunction() {}

      expect(isAsyncFunction(normalFunction)).toBe(false)
      expect(isAsyncFunction(arrowFunction)).toBe(false)
      expect(isAsyncFunction(generatorFunction)).toBe(false)
      expect(isAsyncFunction({})).toBe(false)
      expect(isAsyncFunction(null)).toBe(false)
      expect(isAsyncFunction(undefined)).toBe(false)
      expect(isAsyncFunction('string')).toBe(false)
      expect(isAsyncFunction(123)).toBe(false)
    })

    test('isESModule 检查 ES 模块', () => {
      const esModule = { __esModule: true, default: '默认值' }
      expect(isESModule(esModule)).toBe(true)

      const esModuleWithFunction = { __esModule: true, default: () => {} }
      expect(isESModule(esModuleWithFunction)).toBe(true)

      const esModuleWithNumber = { __esModule: true, default: 42 }
      expect(isESModule(esModuleWithNumber)).toBe(true)

      const esModuleWithNull = { __esModule: true, default: null }
      expect(isESModule(esModuleWithNull)).toBe(true)

      const esModuleWithUndefined = { __esModule: true, default: undefined }
      expect(isESModule(esModuleWithUndefined)).toBe(true)

      const commonJSModule = { exports: 'value' }
      expect(isESModule(commonJSModule)).toBe(false)

      const plainObject = { default: 'value' }
      expect(isESModule(plainObject)).toBe(false)

      const esModuleWithoutDefault = { __esModule: true }
      expect(isESModule(esModuleWithoutDefault)).toBe(false)

      const esModuleFalse = { __esModule: false, default: 'value' }
      expect(isESModule(esModuleFalse)).toBe(false)

      const esModuleString = { __esModule: 'true', default: 'value' }
      expect(isESModule(esModuleString)).toBe(false)

      expect(isESModule(null)).toBe(false)
      expect(isESModule(undefined)).toBe(false)
      expect(isESModule('string')).toBe(false)
      expect(isESModule(123)).toBe(false)
      expect(isESModule([])).toBe(false)
      expect(isESModule(false)).toBe(false)
    })
  })
})
