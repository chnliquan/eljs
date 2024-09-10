function isTypeOf(target, type) {
  if (!type) {
    return false;
  }
  try {
    type = type.toLocaleLowerCase();
    if (target === undefined) {
      return type === 'undefined';
    }
    if (target === null) {
      return type === 'null';
    }
    return Object.prototype.toString.call(target).toLocaleLowerCase() === "[object ".concat(type, "]");
  } catch (err) {
    return false;
  }
}

/**
 * 是否是 undefined
 * @param target 目标对象
 */
export function isUndefined(target) {
  return isTypeOf(target, 'undefined');
}

/**
 * 是否是 Null
 * @param target 目标对象
 */
export function isNull(target) {
  return isTypeOf(target, 'null');
}

/**
 * 是否是字符串
 * @param target 目标对象
 */
export function isString(target) {
  return isTypeOf(target, 'string');
}

/**
 * 是否是对象
 * @param target 目标对象
 */
export function isObject(target) {
  return isTypeOf(target, 'Object');
}

/**
 * 是否是数组
 * @param target 目标对象
 */
export function isArray(target) {
  return isTypeOf(target, 'array');
}

/**
 * 是否是函数
 * @param target 目标对象
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export function isFunction(target) {
  return isTypeOf(target, 'function');
}

/**
 * 是否是布尔值
 * @param target 目标对象
 */
export function isBoolean(target) {
  return isTypeOf(target, 'boolean');
}

/**
 * 是否由 Object 扩展的对象
 * @param target 目标对象
 */
export function isPlainObject(target) {
  if (!isObject(target)) {
    return false;
  }
  var proto = Object.getPrototypeOf(target);

  // 支持 Object.create(null)
  if (proto === null) {
    return true;
  }
  var baseProto = proto;
  while (Object.getPrototypeOf(baseProto) !== null) {
    baseProto = Object.getPrototypeOf(baseProto);
  }
  return baseProto === proto;
}

/**
 * 是否是 Promise 实例
 * @param target 目标对象
 */
export function isPromise(target) {
  return target && typeof target.then === 'function';
}

/**
 * 是否是 Generator 函数
 * @param target 目标对象
 */
export function isGeneratorFunction(target) {
  return typeof target === 'function' && target.constructor.name === 'GeneratorFunction';
}

/**
 * 是否是 Async 函数
 * @param target 目标对象
 */
export function isAsyncFunction(target) {
  return typeof target === 'function' && target.constructor.name === 'AsyncFunction';
}