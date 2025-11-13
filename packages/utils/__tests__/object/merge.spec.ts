import { deepMerge } from '../../src/object'

describe('对象工具函数', () => {
  describe('deepMerge 深度合并', () => {
    it('应该合并两个简单对象', () => {
      const obj1 = { a: 1, b: 2 }
      const obj2 = { c: 3, d: 4 }
      const result = deepMerge(obj1, obj2)

      expect(result).toEqual({ a: 1, b: 2, c: 3, d: 4 })
    })

    it('应该合并具有重叠键的对象', () => {
      const obj1 = { a: 1, b: 2 }
      const obj2 = { b: 3, c: 4 }
      const result = deepMerge(obj1, obj2)

      expect(result).toEqual({ a: 1, b: 3, c: 4 })
    })

    it('应该深度合并嵌套对象', () => {
      const obj1 = {
        a: 1,
        nested: {
          x: 1,
          y: 2,
        },
      }
      const obj2 = {
        b: 2,
        nested: {
          y: 3,
          z: 4,
        },
      }
      const result = deepMerge(obj1, obj2)

      expect(result).toEqual({
        a: 1,
        b: 2,
        nested: {
          x: 1,
          y: 3,
          z: 4,
        },
      })
    })

    it('应该合并三个对象', () => {
      const obj1 = { a: 1 }
      const obj2 = { b: 2 }
      const obj3 = { c: 3 }
      const result = deepMerge(obj1, obj2, obj3)

      expect(result).toEqual({ a: 1, b: 2, c: 3 })
    })

    it('应该合并四个对象', () => {
      const obj1 = { a: 1 }
      const obj2 = { b: 2 }
      const obj3 = { c: 3 }
      const obj4 = { d: 4 }
      const result = deepMerge(obj1, obj2, obj3, obj4)

      expect(result).toEqual({ a: 1, b: 2, c: 3, d: 4 })
    })

    it('应该合并五个对象', () => {
      const obj1 = { a: 1 }
      const obj2 = { b: 2 }
      const obj3 = { c: 3 }
      const obj4 = { d: 4 }
      const obj5 = { e: 5 }
      const result = deepMerge(obj1, obj2, obj3, obj4, obj5)

      expect(result).toEqual({ a: 1, b: 2, c: 3, d: 4, e: 5 })
    })

    it('应该合并六个对象', () => {
      const obj1 = { a: 1 }
      const obj2 = { b: 2 }
      const obj3 = { c: 3 }
      const obj4 = { d: 4 }
      const obj5 = { e: 5 }
      const obj6 = { f: 6 }
      const result = deepMerge(obj1, obj2, obj3, obj4, obj5, obj6)

      expect(result).toEqual({ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 })
    })

    it('应该正确处理数组', () => {
      const obj1 = { arr: [1, 2] }
      const obj2 = { arr: [3, 4] }
      const result = deepMerge(obj1, obj2)

      expect(result).toEqual({ arr: [1, 2, 3, 4] })
    })

    it('应该处理空对象', () => {
      const obj1 = {}
      const obj2 = { a: 1 }
      const result = deepMerge(obj1, obj2)

      expect(result).toEqual({ a: 1 })
    })

    it('应该处理 null 和 undefined 值', () => {
      const obj1 = { a: 1 }
      const result1 = deepMerge(obj1, null)
      const result2 = deepMerge(obj1, undefined)

      expect(result1).toEqual({ a: 1 })
      expect(result2).toEqual({ a: 1 })
    })

    it('应该处理多个 null/undefined 值', () => {
      const obj1 = { a: 1 }
      const result = deepMerge(obj1, null, undefined, { b: 2 })

      expect(result).toEqual({ a: 1, b: 2 })
    })

    it('不应该修改原始对象', () => {
      const obj1 = { a: 1, nested: { x: 1 } }
      const obj2 = { b: 2, nested: { y: 2 } }
      const originalObj1 = JSON.parse(JSON.stringify(obj1))
      const originalObj2 = JSON.parse(JSON.stringify(obj2))

      deepMerge(obj1, obj2)

      expect(obj1).toEqual(originalObj1)
      expect(obj2).toEqual(originalObj2)
    })

    it('应该处理深层嵌套对象', () => {
      const obj1 = {
        level1: {
          level2: {
            level3: {
              value: 'original',
            },
          },
        },
      }
      const obj2 = {
        level1: {
          level2: {
            level3: {
              value: 'updated',
              newValue: 'added',
            },
          },
        },
      }
      const result = deepMerge(obj1, obj2)

      expect(result).toEqual({
        level1: {
          level2: {
            level3: {
              value: 'updated',
              newValue: 'added',
            },
          },
        },
      })
    })

    it('应该处理函数和其他复杂类型', () => {
      const fn1 = () => 'fn1'
      const fn2 = () => 'fn2'
      const obj1 = { func: fn1, date: new Date('2023-01-01') }
      const obj2 = { func: fn2, number: 42 }
      const result = deepMerge(obj1, obj2)

      expect(result.func).toBe(fn2)
      expect(result.number).toBe(42)
      expect(result.date).toEqual(new Date('2023-01-01'))
    })
  })
})
