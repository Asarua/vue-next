//* 常规处理，Object、Array之类的，在array中代理了includes、indexOf、lastIndexOf、push、pop、shift、unshift、splice方法
import {
  reactive,
  readonly,
  toRaw,
  ReactiveFlags,
  Target,
  readonlyMap,
  reactiveMap
} from './reactive'
import { TrackOpTypes, TriggerOpTypes } from './operations'
import {
  track,
  trigger,
  ITERATE_KEY,
  pauseTracking,
  resetTracking
} from './effect'
import {
  isObject,
  hasOwn,
  isSymbol,
  hasChanged,
  isArray,
  isIntegerKey,
  extend,
  makeMap
} from '@vue/shared'
import { isRef } from './ref'

// 创建不进行依赖收集的key的列表
/*
  isNonTrackableKeys('__proto__') -> true
  isNonTrackableKeys('others') -> false
*/
const isNonTrackableKeys = /*#__PURE__*/ makeMap(`__proto__,__v_isRef,__isVue`)

// 内置的Symbol属性列表
const builtInSymbols = new Set(
  Object.getOwnPropertyNames(Symbol)
    .map(key => (Symbol as any)[key])
    .filter(isSymbol)
)

// 获取get方法
const get = /*#__PURE__*/ createGetter()
const shallowGet = /*#__PURE__*/ createGetter(false, true)
const readonlyGet = /*#__PURE__*/ createGetter(true)
const shallowReadonlyGet = /*#__PURE__*/ createGetter(true, true)

// 创建数组容器
const arrayInstrumentations: Record<string, Function> = {}
// instrument identity-sensitive Array methods to account for possible reactive
// values
// 用于判断值的方法，对每一项添加依赖
;(['includes', 'indexOf', 'lastIndexOf'] as const).forEach(key => {
  // 获取数组原生的方法
  const method = Array.prototype[key] as any
  // 在容器中模拟
  arrayInstrumentations[key] = function(this: unknown[], ...args: unknown[]) {
    // 取得解代理的对象
    const arr = toRaw(this)
    // 对数组的每一项添加get依赖收集
    for (let i = 0, l = this.length; i < l; i++) {
      track(arr, TrackOpTypes.GET, i + '')
    }
    // we run the method using the original args first (which may be reactive)
    // 首先使用原生的方法来进行尝试
    const res = method.apply(arr, args)
    // 如果不存在
    if (res === -1 || res === false) {
      // if that didn't work, run it again using raw values.
      // 我们使用原始值再次尝试
      return method.apply(arr, args.map(toRaw))
    } else {
      return res
    }
  }
})
// instrument length-altering mutation methods to avoid length being tracked
// which leads to infinite loops in some cases (#2137)
// 数组中会改变length的方法，需要做特殊处理，防止造成无限循环，因为触发这些方法的时候，会取得以及设置length属性
;(['push', 'pop', 'shift', 'unshift', 'splice'] as const).forEach(key => {
  // 获取原生的方法
  const method = Array.prototype[key] as any
  // 在容器中模拟
  arrayInstrumentations[key] = function(this: unknown[], ...args: unknown[]) {
    // 在触发这些方法之前，关闭依赖收集
    pauseTracking()
    // 执行
    const res = method.apply(this, args)
    // 重置依赖收集
    resetTracking()
    return res
  }
})

// 创建get函数
function createGetter(isReadonly = false, shallow = false) {
  return function get(target: Target, key: string | symbol, receiver: object) {
    // 如果访问的是__v_isReactive
    if (key === ReactiveFlags.IS_REACTIVE) {
      // 返回是否不是只读
      return !isReadonly
      // 如果查看的key是__v_isReadonly
    } else if (key === ReactiveFlags.IS_READONLY) {
      // 返回是否只读
      return isReadonly
    } else if (
      // 如果访问的是__v_raw
      key === ReactiveFlags.RAW &&
      // 并且存在代理记录
      receiver === (isReadonly ? readonlyMap : reactiveMap).get(target)
    ) {
      // 直接返回
      return target
    }

    // 判断是否是数组
    const targetIsArray = isArray(target)

    // 如果不是只读的数组，并且访问的是容器中给他代理的方法
    if (!isReadonly && targetIsArray && hasOwn(arrayInstrumentations, key)) {
      // 使用容器中的代理方法
      return Reflect.get(arrayInstrumentations, key, receiver)
    }

    // 获取值
    const res = Reflect.get(target, key, receiver)

    if (
      // 如果获取的key是Symbol
      isSymbol(key)
        ? // 判断是否是在系统原生的Symbol列表中
          builtInSymbols.has(key as symbol)
        : // 如果不是则判断是否是需要收集依赖的key
          isNonTrackableKeys(key)
    ) {
      return res
    }

    // 如果不是只读
    if (!isReadonly) {
      // 添加get依赖收集
      track(target, TrackOpTypes.GET, key)
    }

    // 如果是浅层代理
    if (shallow) {
      // 返回
      return res
    }

    // 如果是ref代理
    if (isRef(res)) {
      // ref unwrapping - does not apply for Array + integer key.
      // 获取是否可以解代理，如果不是数组，或者key不是数字的情况下为true
      const shouldUnwrap = !targetIsArray || !isIntegerKey(key)
      // 如果可以，则返回解代理的值，否则返回自身
      return shouldUnwrap ? res.value : res
    }

    // 如果返回的是对象
    if (isObject(res)) {
      // Convert returned value into a proxy as well. we do the isObject check
      // here to avoid invalid value warning. Also need to lazy access readonly
      // and reactive here to avoid circular dependency.
      // 根据是否只读，返回响应的值（Proxy默认只能代理一层，当前场景 用于深层响应）
      return isReadonly ? readonly(res) : reactive(res)
    }

    //返回结果
    return res
  }
}

// 创建set方法
const set = /*#__PURE__*/ createSetter()
const shallowSet = /*#__PURE__*/ createSetter(true)

function createSetter(shallow = false) {
  return function set(
    target: object,
    key: string | symbol,
    value: unknown,
    receiver: object
  ): boolean {
    // 获取旧的值
    const oldValue = (target as any)[key]
    // 如果不是浅层
    if (!shallow) {
      // 获取解代理之后的值
      value = toRaw(value)
      // 如果不是数组并且过去的值是ref代理之后的并且新值不是ref代理之后的
      if (!isArray(target) && isRef(oldValue) && !isRef(value)) {
        // 更改ref代理值的value
        oldValue.value = value
        return true
      }
    } else {
      // in shallow mode, objects are set as-is regardless of reactive or not
      // 在浅层模式下，不管对象会不会反应都按原样设置
    }

    // 判断是否是已有的属性（在数组中push一个值会触发push、length、新的下标、length四个属性，unshift的更多，所以要区分是更改已有的值还是添加新值）
    const hadKey =
      // 如果是数组，并且属性是数字，也就是下标
      isArray(target) && isIntegerKey(key)
        ? // 判断是否是已有的下标
          Number(key) < target.length
        : // 如果不是数组或者数组中访问的不是下标，那么判断是否存在这个属性
          hasOwn(target, key)
    // 进行值的修改
    const result = Reflect.set(target, key, value, receiver)
    // don't trigger if target is something up in the prototype chain of original
    // 如果目标是原型链中的某个东西，就不要触发
    if (target === toRaw(receiver)) {
      // 如果不存在对应的属性
      if (!hadKey) {
        // 触发target的添加操作
        trigger(target, TriggerOpTypes.ADD, key, value)
        // 如果存在属性，并且旧值和新值发生了变化
      } else if (hasChanged(value, oldValue)) {
        // 触发target的修改操作
        trigger(target, TriggerOpTypes.SET, key, value, oldValue)
      }
    }
    return result
  }
}

// 删除属性
function deleteProperty(target: object, key: string | symbol): boolean {
  // 判断是否存在这个属性
  const hadKey = hasOwn(target, key)
  // 获取旧的值
  const oldValue = (target as any)[key]
  // 删除属性
  const result = Reflect.deleteProperty(target, key)
  // 如果成功删除
  if (result && hadKey) {
    // 触发target的删除操作
    trigger(target, TriggerOpTypes.DELETE, key, undefined, oldValue)
  }
  return result
}

// 创建has方法
function has(target: object, key: string | symbol): boolean {
  // 判断是否有这个属性
  const result = Reflect.has(target, key)
  // 如果key不是Symbol或者是Symbol但是不是原生的Symbol方法
  if (!isSymbol(key) || !builtInSymbols.has(key)) {
    // 添加has的依赖
    track(target, TrackOpTypes.HAS, key)
  }
  // 返回是否存在
  return result
}

// 获取对象的所有属性
function ownKeys(target: object): (string | symbol)[] {
  // 如果是数组，则添加length的依赖收集，如果不是则添加key的依赖收集
  track(target, TrackOpTypes.ITERATE, isArray(target) ? 'length' : ITERATE_KEY)
  // 返回所有的key
  return Reflect.ownKeys(target)
}

// 可变的操作
export const mutableHandlers: ProxyHandler<object> = {
  get,
  set,
  deleteProperty,
  has,
  ownKeys
}

// 只读操作
export const readonlyHandlers: ProxyHandler<object> = {
  get: readonlyGet,
  set(target, key) {
    if (__DEV__) {
      console.warn(
        `Set operation on key "${String(key)}" failed: target is readonly.`,
        target
      )
    }
    return true
  },
  deleteProperty(target, key) {
    if (__DEV__) {
      console.warn(
        `Delete operation on key "${String(key)}" failed: target is readonly.`,
        target
      )
    }
    return true
  }
}

// 浅层响应操作
export const shallowReactiveHandlers: ProxyHandler<object> = extend(
  {},
  mutableHandlers,
  {
    get: shallowGet,
    set: shallowSet
  }
)

// Props handlers are special in the sense that it should not unwrap top-level
// refs (in order to allow refs to be explicitly passed down), but should
// retain the reactivity of the normal readonly object.
// 浅层只读操作
export const shallowReadonlyHandlers: ProxyHandler<object> = extend(
  {},
  readonlyHandlers,
  {
    get: shallowReadonlyGet
  }
)
