# 函数类型定义优化

## 问题背景

ESLint 规则 `@typescript-eslint/ban-types` 不允许使用 `Function` 作为类型，因为：

1. **过于宽泛**：`Function` 类型接受任何函数式值，缺乏类型安全性
2. **缺乏约束**：无法提供参数和返回值的类型信息
3. **不推荐使用**：TypeScript 官方建议使用更具体的函数签名

## 解决方案

### 1. 替代类型定义

我们定义了更精确的函数类型：

```typescript
// 替代 Function 的精确类型
export type AnyFunction = (...args: any[]) => any
export type AsyncFunction = (...args: any[]) => Promise<any>
export type GeneratorFunction = (...args: any[]) => Generator<any, any, any>
export type AsyncGeneratorFunction = (...args: any[]) => AsyncGenerator<any, any, any>
```

### 2. 类型安全的实现

#### 之前（有问题的实现）
```typescript
// ❌ ESLint 错误：Don't use `Function` as a type
export function isFunction<T = Function>(target: unknown): target is T
function getFunctionConstructor(fn: Function): Function | null
```

#### 之后（优化的实现）
```typescript
// ✅ 类型安全且具体
export function isFunction<T extends AnyFunction = AnyFunction>(target: unknown): target is T
function getFunctionConstructor(fn: AnyFunction): (new (...args: any[]) => any) | null
```

### 3. 类型推断优势

优化后的类型定义提供了更好的类型推断：

```typescript
// 使用示例
async function myAsyncFunc(x: number): Promise<string> {
  return x.toString()
}

function* myGenFunc(start: number): Generator<number, void, unknown> {
  yield start
}

// 类型检查和推断
if (isAsyncFunction(myAsyncFunc)) {
  // TypeScript 正确推断 myAsyncFunc 为 AsyncFunction 类型
  // 具有更精确的类型信息
}

if (isGeneratorFunction(myGenFunc)) {
  // TypeScript 正确推断 myGenFunc 为 GeneratorFunction 类型
}
```

## 类型定义详解

### AnyFunction
```typescript
type AnyFunction = (...args: any[]) => any
```
- **用途**：通用函数类型，替代 `Function`
- **特点**：接受任意参数，返回任意值
- **适用场景**：需要表示"任何函数"的情况

### AsyncFunction
```typescript
type AsyncFunction = (...args: any[]) => Promise<any>
```
- **用途**：异步函数类型
- **特点**：返回 Promise 的函数
- **适用场景**：async/await 函数检测

### GeneratorFunction
```typescript
type GeneratorFunction = (...args: any[]) => Generator<any, any, any>
```
- **用途**：生成器函数类型
- **特点**：返回 Generator 的函数
- **适用场景**：function* 函数检测

### AsyncGeneratorFunction
```typescript
type AsyncGeneratorFunction = (...args: any[]) => AsyncGenerator<any, any, any>
```
- **用途**：异步生成器函数类型
- **特点**：返回 AsyncGenerator 的函数
- **适用场景**：async function* 函数检测

## 使用建议

### 1. 类型导入
```typescript
import { 
  AnyFunction, 
  AsyncFunction, 
  GeneratorFunction, 
  AsyncGeneratorFunction 
} from '@eljs/utils'
```

### 2. 函数参数约束
```typescript
// 推荐：使用具体的函数类型
function executeAsync(fn: AsyncFunction) {
  return fn()
}

// 不推荐：使用宽泛的 Function 类型
// function executeAsync(fn: Function) { ... }
```

### 3. 泛型约束
```typescript
// 推荐：约束泛型为具体函数类型
function createWrapper<T extends AnyFunction>(fn: T): T {
  return fn
}

// 更精确的约束
function createAsyncWrapper<T extends AsyncFunction>(fn: T): T {
  return fn
}
```

## 兼容性说明

- ✅ **向后兼容**：所有现有代码无需修改
- ✅ **类型安全**：提供更好的类型检查
- ✅ **性能无影响**：运行时行为完全相同
- ✅ **ESLint 兼容**：通过所有代码质量检查

## 最佳实践

1. **优先使用具体类型**：根据实际需求选择最合适的函数类型
2. **避免过度泛化**：不要在所有地方都使用 `AnyFunction`
3. **利用类型推断**：让 TypeScript 自动推断函数类型
4. **适当的泛型约束**：在泛型函数中使用函数类型作为约束

这些优化确保了代码既满足 ESLint 规则要求，又提供了更好的类型安全性和开发体验。
