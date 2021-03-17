//* 集合类的处理（Vue3使用了创建对象来模拟集合类的功能，代理了其中的get、size、has、add、set、delete、clear、forEach几个属性）
//! Set Map WeakMap WeakSet
/*
  因为集合类对象的赋值、取值，跟他们内部的this指向有关，在Proxy代理的时候，取值取到的this是代理后的Proxy实例,
  所以做了collectionHandlers和baseHandlers两个处理

  ```js
    const map = new Map([["name","Asarua"]])
    const mapProxy = new Proxy(map, {
      get(target, key, receiver) {
        console.log("取值:", key)
        return Reflect.get(target, key, receiver)
      }
    })
    mapProxy.get("name")

    取值: get
  ```
*/
import { toRaw, reactive, readonly, ReactiveFlags } from './reactive'
import { track, trigger, ITERATE_KEY, MAP_KEY_ITERATE_KEY } from './effect'
import { TrackOpTypes, TriggerOpTypes } from './operations'
import {
  isObject,
  capitalize,
  hasOwn,
  hasChanged,
  toRawType,
  isMap
} from '@vue/shared'

export type CollectionTypes = IterableCollections | WeakCollections

type IterableCollections = Map<any, any> | Set<any>
type WeakCollections = WeakMap<any, any> | WeakSet<any>
type MapTypes = Map<any, any> | WeakMap<any, any>
type SetTypes = Set<any> | WeakSet<any>

// 添加响应式
const toReactive = <T extends unknown>(value: T): T =>
  isObject(value) ? reactive(value) : value

// 添加只读
const toReadonly = <T extends unknown>(value: T): T =>
  isObject(value) ? readonly(value as Record<any, any>) : value

const toShallow = <T extends unknown>(value: T): T => value

// 获取集合类数据的prototype
const getProto = <T extends CollectionTypes>(v: T): any =>
  Reflect.getPrototypeOf(v)

// 创建模拟的get函数
function get(
  target: MapTypes,
  key: unknown,
  isReadonly = false,
  isShallow = false
) {
  // #1772: readonly(reactive(Map)) should return readonly + reactive version
  // of the value
  // 获取代理的对象
  target = (target as any)[ReactiveFlags.RAW]
  // 对target和key进行解响应操作
  const rawTarget = toRaw(target)
  const rawKey = toRaw(key)
  // 如果key不等于rawKey，说明key是个响应的数据
  if (key !== rawKey) {
    // 如果不是只读，那么添加get依赖收集
    !isReadonly && track(rawTarget, TrackOpTypes.GET, key)
  }
  // 如果不是只读，那么添加get依赖收集
  !isReadonly && track(rawTarget, TrackOpTypes.GET, rawKey)
  // 获取原型上的has方法，用于判断是否存在某个属性
  const { has } = getProto(rawTarget)
  // 根据只读、浅层属性获取响应包裹器
  const wrap = isReadonly ? toReadonly : isShallow ? toShallow : toReactive
  // 如果存在传入的key
  if (has.call(rawTarget, key)) {
    // 则返回被包裹的取得的值
    return wrap(target.get(key))
    // 如果存在未代理的key
  } else if (has.call(rawTarget, rawKey)) {
    // 返回被包裹的取得的值
    return wrap(target.get(rawKey))
  }
}

// 是否存在某个属性
function has(this: CollectionTypes, key: unknown, isReadonly = false): boolean {
  // 取得代理的对象
  const target = (this as any)[ReactiveFlags.RAW]
  // 对target和Key进行解响应操作
  const rawTarget = toRaw(target)
  const rawKey = toRaw(key)
  // 如果key不等于rawKey，说明key是个响应的数据
  if (key !== rawKey) {
    // 如果不是只读，那么添加has响应依赖收集
    !isReadonly && track(rawTarget, TrackOpTypes.HAS, key)
  }
  // 如果不是只读，那么添加has依赖收集
  !isReadonly && track(rawTarget, TrackOpTypes.HAS, rawKey)
  // 返回是否存在属性
  return key === rawKey
    ? target.has(key)
    : target.has(key) || target.has(rawKey)
}

// 获取长度
function size(target: IterableCollections, isReadonly = false) {
  // 取得代理的对象
  target = (target as any)[ReactiveFlags.RAW]
  // 如果不是只读则添加迭代依赖收集
  !isReadonly && track(toRaw(target), TrackOpTypes.ITERATE, ITERATE_KEY)
  // 获取原始对象的size
  return Reflect.get(target, 'size', target)
}

// 模拟Set结构的add方法
function add(this: SetTypes, value: unknown) {
  // 取得解代理的值
  value = toRaw(value)
  // 解代理指向的对象
  const target = toRaw(this)
  // 获取target的prototype
  const proto = getProto(target)
  // 判断是否存在当前值
  const hadKey = proto.has.call(target, value)
  // 如果不存在
  if (!hadKey) {
    // 添加
    target.add(value)
    // 触发依赖
    trigger(target, TriggerOpTypes.ADD, value, value)
  }
  return this
}

// 模拟Map数据结构的set方法
function set(this: MapTypes, key: unknown, value: unknown) {
  // 取得解代理的值
  value = toRaw(value)
  // 解代理指向的对象
  const target = toRaw(this)
  // 从原型中拿到has和get方法
  const { has, get } = getProto(target)

  // 判断是否存在当前属性
  let hadKey = has.call(target, key)
  // 如果不存在
  if (!hadKey) {
    // 对key进行解代理
    key = toRaw(key)
    // 判断是否存在当前属性
    hadKey = has.call(target, key)
    // 如果是在开发阶段
  } else if (__DEV__) {
    // 校验是否因为传入的key未解代理
    checkIdentityKeys(target, has, key)
  }

  // 获取旧的值
  const oldValue = get.call(target, key)
  // 设置新值
  target.set(key, value)
  // 如果解代理之后的属性依然不存在
  if (!hadKey) {
    // 触发add依赖
    trigger(target, TriggerOpTypes.ADD, key, value)
    // 如果值有发生变化
  } else if (hasChanged(value, oldValue)) {
    // 触发set依赖
    trigger(target, TriggerOpTypes.SET, key, value, oldValue)
  }
  return this
}

// 模拟删除
function deleteEntry(this: CollectionTypes, key: unknown) {
  // 获取解代理指向的对象
  const target = toRaw(this)
  // 从指向的对象的原型中获取has和get方法
  const { has, get } = getProto(target)
  // 判断是否存在传入的属性
  let hadKey = has.call(target, key)
  // 如果不存在
  if (!hadKey) {
    // 获取解代理的key
    key = toRaw(key)
    // 判断是否存在
    hadKey = has.call(target, key)
    // 如果在开发环境
  } else if (__DEV__) {
    // 校验是否因为传入的key未解代理
    checkIdentityKeys(target, has, key)
  }

  // 获取之前的值
  const oldValue = get ? get.call(target, key) : undefined
  // forward the operation before queueing reactions
  // 在队列反应之前转发操作
  const result = target.delete(key)
  // 如果存在
  if (hadKey) {
    // 触发delete
    trigger(target, TriggerOpTypes.DELETE, key, undefined, oldValue)
  }
  return result
}

// 清除
function clear(this: IterableCollections) {
  // 获取原始值
  const target = toRaw(this)
  // 判断是否存在值
  const hadItems = target.size !== 0
  // 旧指向
  const oldTarget = __DEV__
    ? isMap(target)
      ? new Map(target)
      : new Set(target)
    : undefined
  // forward the operation before queueing reactions
  // 在队列反应之前转发操作
  const result = target.clear()
  // 如果存在值
  if (hadItems) {
    // 执行清除操作
    trigger(target, TriggerOpTypes.CLEAR, undefined, undefined, oldTarget)
  }
  return result
}

// 创建forEach函数
function createForEach(isReadonly: boolean, isShallow: boolean) {
  return function forEach(
    this: IterableCollections,
    callback: Function,
    thisArg?: unknown
  ) {
    // 获取this（响应式对象）
    const observed = this as any
    // 找到原始的值
    const target = observed[ReactiveFlags.RAW]
    // 防止原始的值就是响应式的，做解响应式操作
    const rawTarget = toRaw(target)
    // 根据只读、浅层条件来获取包裹
    const wrap = isReadonly ? toReadonly : isShallow ? toShallow : toReactive
    // 如果不是只读的，那么添加迭代依赖收集
    !isReadonly && track(rawTarget, TrackOpTypes.ITERATE, ITERATE_KEY)
    return target.forEach((value: unknown, key: unknown) => {
      // important: make sure the callback is
      // 1. invoked with the reactive map as `this` and 3rd arg
      // 2. the value received should be a corresponding reactive/readonly.
      // 修改this，添加响应
      return callback.call(thisArg, wrap(value), wrap(key), observed)
    })
  }
}

// 迭代器iterate
interface Iterable {
  [Symbol.iterator](): Iterator
}

interface Iterator {
  next(value?: any): IterationResult
}

interface IterationResult {
  value: any
  done: boolean
}

// 创建迭代方法
function createIterableMethod(
  // 方法名
  method: string | symbol,
  // 是否只读
  isReadonly: boolean,
  // 是否浅代理
  isShallow: boolean
) {
  return function(
    this: IterableCollections,
    ...args: unknown[]
  ): Iterable & Iterator {
    // 获取代理的对象
    const target = (this as any)[ReactiveFlags.RAW]
    // 解代理
    const rawTarget = toRaw(target)
    // 判断是否是Map对象
    const targetIsMap = isMap(rawTarget)
    // 是否为双值
    const isPair =
      // 假如方法是entries或者方法是Symbol.iterator的情况下是Map对象
      method === 'entries' || (method === Symbol.iterator && targetIsMap)
    // 是否取的为keys
    const isKeyOnly = method === 'keys' && targetIsMap
    // 获取内联的迭代器
    const innerIterator = target[method](...args)
    // 根据只读、浅层选项获取包裹选项
    const wrap = isReadonly ? toReadonly : isShallow ? toShallow : toReactive
    // 如果不是只读
    !isReadonly &&
      // 添加迭代依赖收集
      track(
        rawTarget,
        TrackOpTypes.ITERATE,
        // 如果取得是keys，那么取的是Map的迭代key，否则不是
        isKeyOnly ? MAP_KEY_ITERATE_KEY : ITERATE_KEY
      )
    // return a wrapped iterator which returns observed versions of the
    // values emitted from the real iterator
    // 返回一个包裹后的迭代器，它返回从实际迭代器发出的值的观察版本
    return {
      // iterator protocol
      next() {
        // 实际迭代器返回值
        const { value, done } = innerIterator.next()
        return done
          ? // 如果已完成，则直接返回
            { value, done }
          : {
              // 否则，如果是取得是类似于entries之类的两个结果的，则返回一个数组，里面是包裹过的值，否则返回包裹的值
              value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
              done
            }
      },
      // iterable protocol
      [Symbol.iterator]() {
        return this
      }
    }
  }
}

// 创建只读方法
function createReadonlyMethod(type: TriggerOpTypes): Function {
  return function(this: CollectionTypes, ...args: unknown[]) {
    // 如果是在开发环境
    if (__DEV__) {
      // 警告要操作的值是只读的
      const key = args[0] ? `on key "${args[0]}" ` : ``
      console.warn(
        `${capitalize(type)} operation ${key}failed: target is readonly.`,
        toRaw(this)
      )
    }
    // 如果是删除，则是false，否则为true
    return type === TriggerOpTypes.DELETE ? false : this
  }
}

// 可变的容器
const mutableInstrumentations: Record<string, Function> = {
  get(this: MapTypes, key: unknown) {
    return get(this, key)
  },
  get size() {
    return size((this as unknown) as IterableCollections)
  },
  has,
  add,
  set,
  delete: deleteEntry,
  clear,
  forEach: createForEach(false, false)
}

// 浅层的容器
const shallowInstrumentations: Record<string, Function> = {
  get(this: MapTypes, key: unknown) {
    return get(this, key, false, true)
  },
  get size() {
    return size((this as unknown) as IterableCollections)
  },
  has,
  add,
  set,
  delete: deleteEntry,
  clear,
  forEach: createForEach(false, true)
}

// 只读容器
const readonlyInstrumentations: Record<string, Function> = {
  get(this: MapTypes, key: unknown) {
    return get(this, key, true)
  },
  get size() {
    return size((this as unknown) as IterableCollections, true)
  },
  has(this: MapTypes, key: unknown) {
    return has.call(this, key, true)
  },
  add: createReadonlyMethod(TriggerOpTypes.ADD),
  set: createReadonlyMethod(TriggerOpTypes.SET),
  delete: createReadonlyMethod(TriggerOpTypes.DELETE),
  clear: createReadonlyMethod(TriggerOpTypes.CLEAR),
  forEach: createForEach(true, false)
}

// 迭代器的方法
const iteratorMethods = ['keys', 'values', 'entries', Symbol.iterator]
iteratorMethods.forEach(method => {
  mutableInstrumentations[method as string] = createIterableMethod(
    method,
    false,
    false
  )
  readonlyInstrumentations[method as string] = createIterableMethod(
    method,
    true,
    false
  )
  shallowInstrumentations[method as string] = createIterableMethod(
    method,
    false,
    true
  )
})

// 创建getter方法
function createInstrumentationGetter(isReadonly: boolean, shallow: boolean) {
  // 根据只读、浅层属性来获取容器
  const instrumentations = shallow
    ? shallowInstrumentations
    : isReadonly
      ? readonlyInstrumentations
      : mutableInstrumentations

  // 返回get方法
  return (
    target: CollectionTypes,
    key: string | symbol,
    receiver: CollectionTypes
  ) => {
    // 如果查看的是__v_isReactive
    if (key === ReactiveFlags.IS_REACTIVE) {
      // 返回是否只读的取反值
      return !isReadonly
      // 如果查看的是"__v_isReadonly"
    } else if (key === ReactiveFlags.IS_READONLY) {
      return isReadonly
      // 如果查看的是初始对象
    } else if (key === ReactiveFlags.RAW) {
      return target
    }

    return Reflect.get(
      // 如果访问的是get、size、has、add、set、delete、clear、forEach中的某个属性
      hasOwn(instrumentations, key) && key in target
        ? // 则使用我们创建的容器的方法
          instrumentations
        : // 否则使用传递的对象
          target,
      key,
      receiver
    )
  }
}

// 可变的集合类处理
export const mutableCollectionHandlers: ProxyHandler<CollectionTypes> = {
  get: createInstrumentationGetter(false, false)
}

// 浅层响应的集合类处理
export const shallowCollectionHandlers: ProxyHandler<CollectionTypes> = {
  get: createInstrumentationGetter(false, true)
}

// 只读的集合类处理
export const readonlyCollectionHandlers: ProxyHandler<CollectionTypes> = {
  get: createInstrumentationGetter(true, false)
}

// 校验一致的key
function checkIdentityKeys(
  target: CollectionTypes,
  has: (key: unknown) => boolean,
  key: unknown
) {
  // 获取解代理的值
  const rawKey = toRaw(key)
  // 如果传入的key和解代理之后的值不一样，并且所在的对象中存在解代理之后的值
  if (rawKey !== key && has.call(target, rawKey)) {
    // 获取原始值
    const type = toRawType(target)
    console.warn(
      `Reactive ${type} contains both the raw and reactive ` +
        `versions of the same object${type === `Map` ? ` as keys` : ``}, ` +
        `which can lead to inconsistencies. ` +
        `Avoid differentiating between the raw and reactive versions ` +
        `of an object and only use the reactive version if possible.`
    )
  }
}
