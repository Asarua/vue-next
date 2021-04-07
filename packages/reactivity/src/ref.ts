/*
  ! https://github.com/vuejs/vue-next/pull/1900
  ? https://github.com/vuejs/vue-next/pull/1900/files

  ! 使用class，而不是普通对象的原因：大大提高了性能。
    最初的实现在每个单独的ref上创建新的get和set函数。
    这解释了在创建大量函数时内存消耗较高的原因。优化器也不太能够优化它，因为它们是不同的函数。

    如果使用class之后，getter和setter都是原型链中的方法，只会声明一次。

    @example

    ```ts 原来的createRef函数内部
      const r = {
        __v_isRef: true,
        get value() {
          track(r, TrackOpTypes.GET, 'value')
          return value
        },
        set value(newVal) {
          if (hasChanged(toRaw(newVal), rawValue)) {
            rawValue = newVal
            value = shallow ? newVal : convert(newVal)
            trigger(r, TriggerOpTypes.SET, 'value', newVal)
          }
        }
      }
      return r
    ```

    将用对象的实现变为用class，这会在内部将以下函数的实现更改为类(ref、shallowRef、customRef、toRef、cumputed)。
    对于每个函数，都提供了一个基准来显示速度的提高（通常在70-100%之间）。
    这些基准测试纯get&set性能。没有需要更新的依赖项。

  ! 在使用ref进行track和trigger的时候需要toRaw是因为
    代理refs时第一个解决方案失败。
    此代理将被传递给触发器/跟踪。用toRaw来解决这个问题。这只需要一点点性能，就会相应地更新基准。
*/
import { track, trigger } from './effect'
import { TrackOpTypes, TriggerOpTypes } from './operations'
import { isArray, isObject, hasChanged } from '@vue/shared'
import { reactive, isProxy, toRaw, isReactive } from './reactive'
import { CollectionTypes } from './collectionHandlers'

// 每个ref对象的标识
declare const RefSymbol: unique symbol

// 声明Ref类型，用于ref方法
export interface Ref<T = any> {
  value: T
  /**
   * Type differentiator only.
   * We need this to be in public d.ts but don't want it to show up in IDE
   * autocomplete, so we use a private Symbol instead.
   */
  [RefSymbol]: true
  /**
   * @internal
   */
  _shallow?: boolean
}

export type ToRef<T> = [T] extends [Ref] ? T : Ref<UnwrapRef<T>>
export type ToRefs<T = any> = {
  // #2687: somehow using ToRef<T[K]> here turns the resulting type into
  // a union of multiple Ref<*> types instead of a single Ref<* | *> type.
  [K in keyof T]: T[K] extends Ref ? T[K] : Ref<UnwrapRef<T[K]>>
}

// 转换函数，用于ref对象创建的时候的值的转换
const convert = <T extends unknown>(val: T): T =>
  // 如果是对象，则使用reactive进行代理，否则返回传进来的值
  isObject(val) ? reactive(val) : val

// 重载判断某个值是否是ref处理过的
export function isRef<T>(r: Ref<T> | unknown): r is Ref<T>
export function isRef(r: any): r is Ref {
  return Boolean(r && r.__v_isRef === true)
}

// 重载创建ref对象
export function ref<T extends object>(value: T): ToRef<T>
export function ref<T>(value: T): Ref<UnwrapRef<T>>
export function ref<T = any>(): Ref<T | undefined>
export function ref(value?: unknown) {
  return createRef(value)
}

// 浅层创建ref对象
export function shallowRef<T extends object>(
  value: T
): T extends Ref ? T : Ref<T>
export function shallowRef<T>(value: T): Ref<T>
export function shallowRef<T = any>(): Ref<T | undefined>
export function shallowRef(value?: unknown) {
  return createRef(value, true)
}

// ref实体
class RefImpl<T> {
  // 值
  private _value: T

  // 标识符
  public readonly __v_isRef = true

  // 两个参数：值、是否浅层
  constructor(private _rawValue: T, public readonly _shallow = false) {
    // 如果是浅层，则值直接就是传进来的值，如果不是，将其转换
    this._value = _shallow ? _rawValue : convert(_rawValue)
  }

  // 读取值的时候
  get value() {
    // 添加get的依赖收集
    track(toRaw(this), TrackOpTypes.GET, 'value')
    // 返回当前值
    return this._value
  }

  // 设置值的时候
  set value(newVal) {
    // 如果新值和原本的值发生了改变，才进行后续的逻辑（优化）
    if (hasChanged(toRaw(newVal), this._rawValue)) {
      // 原生值留存
      this._rawValue = newVal
      // 对值进行转换
      this._value = this._shallow ? newVal : convert(newVal)
      // 触发添加过的依赖项
      trigger(toRaw(this), TriggerOpTypes.SET, 'value', newVal)
    }
  }
}

// 创建ref引用对象
function createRef(rawValue: unknown, shallow = false) {
  // 如果是已经包裹过的
  if (isRef(rawValue)) {
    // 直接返回
    return rawValue
  }
  // 否则创建新的ref对象
  return new RefImpl(rawValue, shallow)
}

// 触发ref对象绑定的依赖事件
export function triggerRef(ref: Ref) {
  trigger(toRaw(ref), TriggerOpTypes.SET, 'value', __DEV__ ? ref.value : void 0)
}

// 解ref，返回里面的值
export function unref<T>(ref: T): T extends Ref<infer V> ? V : T {
  return isRef(ref) ? (ref.value as any) : ref
}

// 浅层未包裹的handler
const shallowUnwrapHandlers: ProxyHandler<any> = {
  // 获取未包裹的值
  get: (target, key, receiver) => unref(Reflect.get(target, key, receiver)),
  set: (target, key, value, receiver) => {
    // 取得旧的值
    const oldValue = target[key]
    // 如果旧的值是包裹的并且新的值是未包裹的
    if (isRef(oldValue) && !isRef(value)) {
      // 那么只替换其中的value
      oldValue.value = value
      return true
      // 否则
    } else {
      // 直接修改值
      return Reflect.set(target, key, value, receiver)
    }
  }
}

// 代理Ref对象，用于运行时runtime
export function proxyRefs<T extends object>(
  objectWithRefs: T
): ShallowUnwrapRef<T> {
  // 如果是已经proxy代理过的
  return isReactive(objectWithRefs)
    ? // 直接返回
      objectWithRefs
    : // 返回代理对象
      new Proxy(objectWithRefs, shallowUnwrapHandlers)
}

export type CustomRefFactory<T> = (
  track: () => void,
  trigger: () => void
) => {
  get: () => T
  set: (value: T) => void
}

// 自定义ref对象，可以自定义get以及set事件，通过暴露出来的tract和trigger来触发
/*
  官网示例

  ```js
    function useDebouncedRef(value, delay = 200) {
      let timeout
      return customRef((track, trigger) => {
        return {
          get() {
            track()
            return value
          },
          set(newValue) {
            clearTimeout(timeout)
            timeout = setTimeout(() => {
              value = newValue
              trigger()
            }, delay)
          }
        }
      })
    }

    export default {
      setup() {
        return {
          text: useDebouncedRef('hello')
        }
      }
    }
  ```
*/
class CustomRefImpl<T> {
  private readonly _get: ReturnType<CustomRefFactory<T>>['get']
  private readonly _set: ReturnType<CustomRefFactory<T>>['set']

  public readonly __v_isRef = true

  constructor(factory: CustomRefFactory<T>) {
    const { get, set } = factory(
      () => track(this, TrackOpTypes.GET, 'value'),
      () => trigger(this, TriggerOpTypes.SET, 'value')
    )
    this._get = get
    this._set = set
  }

  // 在get的时候调用自定义的get事件
  get value() {
    return this._get()
  }

  // 在set的时候调用自定义的set事件
  set value(newVal) {
    this._set(newVal)
  }
}

// 创建自定义ref引用
export function customRef<T>(factory: CustomRefFactory<T>): Ref<T> {
  return new CustomRefImpl(factory) as any
}

// 将响应式对象中的每一项都添加ref引用
export function toRefs<T extends object>(object: T): ToRefs<T> {
  // 如果是在开发环境，并且传入的值不是响应式对象
  if (__DEV__ && !isProxy(object)) {
    console.warn(`toRefs() expects a reactive object but received a plain one.`)
  }
  // 判断是数组还是对象
  const ret: any = isArray(object) ? new Array(object.length) : {}
  // 将每一项都添加ref引用
  for (const key in object) {
    ret[key] = toRef(object, key)
  }
  return ret
}

// 更改对象中的某个值为响应式
class ObjectRefImpl<T extends object, K extends keyof T> {
  public readonly __v_isRef = true

  constructor(private readonly _object: T, private readonly _key: K) {}

  get value() {
    return this._object[this._key]
  }

  set value(newVal) {
    this._object[this._key] = newVal
  }
}

// 将对象中的某个值更改为ref响应式
export function toRef<T extends object, K extends keyof T>(
  object: T,
  key: K
): ToRef<T[K]> {
  // 如果该值已经是ref响应
  return isRef(object[key])
    ? // 直接返回
      object[key]
    : // 对其进行ref响应代理
      (new ObjectRefImpl(object, key) as any)
}

// corner case when use narrows type
// Ex. type RelativePath = string & { __brand: unknown }
// RelativePath extends object -> true
type BaseTypes = string | number | boolean

/**
 * This is a special exported interface for other packages to declare
 * additional types that should bail out for ref unwrapping. For example
 * \@vue/runtime-dom can declare it like so in its d.ts:
 *
 * ``` ts
 * declare module '@vue/reactivity' {
 *   export interface RefUnwrapBailTypes {
 *     runtimeDOMBailTypes: Node | Window
 *   }
 * }
 * ```
 *
 * Note that api-extractor somehow refuses to include `declare module`
 * augmentations in its generated d.ts, so we have to manually append them
 * to the final generated d.ts in our build process.
 */
export interface RefUnwrapBailTypes {}

export type ShallowUnwrapRef<T> = {
  [K in keyof T]: T[K] extends Ref<infer V> ? V : T[K]
}

export type UnwrapRef<T> = T extends Ref<infer V>
  ? UnwrapRefSimple<V>
  : UnwrapRefSimple<T>

type UnwrapRefSimple<T> = T extends
  | Function
  | CollectionTypes
  | BaseTypes
  | Ref
  | RefUnwrapBailTypes[keyof RefUnwrapBailTypes]
  ? T
  : T extends Array<any>
    ? { [K in keyof T]: UnwrapRefSimple<T[K]> }
    : T extends object ? UnwrappedObject<T> : T

// Extract all known symbols from an object
// when unwrapping Object the symbols are not `in keyof`, this should cover all the
// known symbols
type SymbolExtract<T> = (T extends { [Symbol.asyncIterator]: infer V }
  ? { [Symbol.asyncIterator]: V }
  : {}) &
  (T extends { [Symbol.hasInstance]: infer V }
    ? { [Symbol.hasInstance]: V }
    : {}) &
  (T extends { [Symbol.isConcatSpreadable]: infer V }
    ? { [Symbol.isConcatSpreadable]: V }
    : {}) &
  (T extends { [Symbol.iterator]: infer V } ? { [Symbol.iterator]: V } : {}) &
  (T extends { [Symbol.match]: infer V } ? { [Symbol.match]: V } : {}) &
  (T extends { [Symbol.matchAll]: infer V } ? { [Symbol.matchAll]: V } : {}) &
  (T extends { [Symbol.replace]: infer V } ? { [Symbol.replace]: V } : {}) &
  (T extends { [Symbol.search]: infer V } ? { [Symbol.search]: V } : {}) &
  (T extends { [Symbol.species]: infer V } ? { [Symbol.species]: V } : {}) &
  (T extends { [Symbol.split]: infer V } ? { [Symbol.split]: V } : {}) &
  (T extends { [Symbol.toPrimitive]: infer V }
    ? { [Symbol.toPrimitive]: V }
    : {}) &
  (T extends { [Symbol.toStringTag]: infer V }
    ? { [Symbol.toStringTag]: V }
    : {}) &
  (T extends { [Symbol.unscopables]: infer V }
    ? { [Symbol.unscopables]: V }
    : {})

type UnwrappedObject<T> = { [P in keyof T]: UnwrapRef<T[P]> } & SymbolExtract<T>
