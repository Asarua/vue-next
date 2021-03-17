import { isObject, toRawType, def } from '@vue/shared'
import {
  mutableHandlers,
  readonlyHandlers,
  shallowReactiveHandlers,
  shallowReadonlyHandlers
} from './baseHandlers'
import {
  mutableCollectionHandlers,
  readonlyCollectionHandlers,
  shallowCollectionHandlers
} from './collectionHandlers'
import { UnwrapRef, Ref } from './ref'

// reactive 响应性标识符
export const enum ReactiveFlags {
  // 用来标记跳过代理
  SKIP = '__v_skip',
  // 用来标记响应对象
  IS_REACTIVE = '__v_isReactive',
  // 用来标记只读对象
  IS_READONLY = '__v_isReadonly',
  // 用来标记被代理的原生对象
  RAW = '__v_raw'
}

// 被代理的对象，应该起码存在某一项
export interface Target {
  [ReactiveFlags.SKIP]?: boolean
  [ReactiveFlags.IS_REACTIVE]?: boolean
  [ReactiveFlags.IS_READONLY]?: boolean
  [ReactiveFlags.RAW]?: any
}

// 响应对象字典
export const reactiveMap = new WeakMap<Target, any>()
// 只读对象字典
export const readonlyMap = new WeakMap<Target, any>()

// 代理的对象的类型
const enum TargetType {
  // 无效的
  INVALID = 0,
  // 常规的
  COMMON = 1,
  // 收集者
  COLLECTION = 2
}

// 根据数据类型获取类型标签
function targetTypeMap(rawType: string) {
  switch (rawType) {
    case 'Object':
    case 'Array':
      // 常规
      return TargetType.COMMON
    case 'Map':
    case 'Set':
    case 'WeakMap':
    case 'WeakSet':
      // 收集者
      return TargetType.COLLECTION
    default:
      // 无效
      return TargetType.INVALID
  }
}

// 获取要代理的对象的类别标签
function getTargetType(value: Target) {
  // 如果是属于被标记的跳过的，或者是被设置了不可以设置新的属性的对象
  return value[ReactiveFlags.SKIP] || !Object.isExtensible(value)
    ? // 它会被标记为无效的
      TargetType.INVALID
    : // 否则会添加类别标记
      targetTypeMap(toRawType(value))
}

// only unwrap nested ref
// 未包裹的嵌套ref对象
type UnwrapNestedRefs<T> = T extends Ref ? T : UnwrapRef<T>

/**
 * Creates a reactive copy of the original object.
 *
 * The reactive conversion is "deep"—it affects all nested properties. In the
 * ES2015 Proxy based implementation, the returned proxy is **not** equal to the
 * original object. It is recommended to work exclusively with the reactive
 * proxy and avoid relying on the original object.
 *
 * A reactive object also automatically unwraps refs contained in it, so you
 * don't need to use `.value` when accessing and mutating their value:
 *
 * ```js
 * const count = ref(0)
 * const obj = reactive({
 *   count
 * })
 *
 * obj.count++
 * obj.count // -> 1
 * count.value // -> 1
 * ```
 */
// 重载reactive函数
export function reactive<T extends object>(target: T): UnwrapNestedRefs<T>
export function reactive(target: object) {
  // if trying to observe a readonly proxy, return the readonly version.
  // 如果是被标记的只读对象
  if (target && (target as Target)[ReactiveFlags.IS_READONLY]) {
    // 那么返回它本身
    return target
  }
  return createReactiveObject(
    target,
    false,
    mutableHandlers,
    mutableCollectionHandlers
  )
}

/**
 * Return a shallowly-reactive copy of the original object, where only the root
 * level properties are reactive. It also does not auto-unwrap refs (even at the
 * root level).
 */
// 浅层响应对象，因为Proxy默认只代理一层，如果设置为浅层，那只会代理最外层
export function shallowReactive<T extends object>(target: T): T {
  return createReactiveObject(
    target,
    false,
    shallowReactiveHandlers,
    shallowCollectionHandlers
  )
}

// 基本数据类型
type Primitive = string | number | boolean | bigint | symbol | undefined | null
// 不需要进行深层只读的数据类型
type Builtin = Primitive | Function | Date | Error | RegExp
export type DeepReadonly<T> = T extends Builtin
  ? T
  : T extends Map<infer K, infer V>
    ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
    : T extends ReadonlyMap<infer K, infer V>
      ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
      : T extends WeakMap<infer K, infer V>
        ? WeakMap<DeepReadonly<K>, DeepReadonly<V>>
        : T extends Set<infer U>
          ? ReadonlySet<DeepReadonly<U>>
          : T extends ReadonlySet<infer U>
            ? ReadonlySet<DeepReadonly<U>>
            : T extends WeakSet<infer U>
              ? WeakSet<DeepReadonly<U>>
              : T extends Promise<infer U>
                ? Promise<DeepReadonly<U>>
                : T extends {}
                  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
                  : Readonly<T>

/**
 * Creates a readonly copy of the original object. Note the returned copy is not
 * made reactive, but `readonly` can be called on an already reactive object.
 */
// 创建只读对象
export function readonly<T extends object>(
  target: T
): DeepReadonly<UnwrapNestedRefs<T>> {
  return createReactiveObject(
    target,
    true,
    readonlyHandlers,
    readonlyCollectionHandlers
  )
}

/**
 * Returns a reactive-copy of the original object, where only the root level
 * properties are readonly, and does NOT unwrap refs nor recursively convert
 * returned properties.
 * This is used for creating the props proxy object for stateful components.
 */
// 创建浅层只读对象
export function shallowReadonly<T extends object>(
  target: T
): Readonly<{ [K in keyof T]: UnwrapNestedRefs<T[K]> }> {
  return createReactiveObject(
    target,
    true,
    shallowReadonlyHandlers,
    readonlyCollectionHandlers
  )
}

// 创建响应式对象
function createReactiveObject(
  // 要代理对对象
  target: Target,
  // 是否只读
  isReadonly: boolean,
  // 基础handler
  baseHandlers: ProxyHandler<any>,
  // 收集者handler
  collectionHandlers: ProxyHandler<any>
) {
  // 如果不是对象
  if (!isObject(target)) {
    // 在开发环境下输出警告
    if (__DEV__) {
      console.warn(`value cannot be made reactive: ${String(target)}`)
    }
    // 直接返回
    return target
  }
  // target is already a Proxy, return it.
  // exception: calling readonly() on a reactive object
  if (
    // 如果要代理的对象中，存在'__v_raw'这个属性，说明是已经代理过的
    target[ReactiveFlags.RAW] &&
    // TODO
    !(isReadonly && target[ReactiveFlags.IS_REACTIVE])
  ) {
    return target
  }
  // target already has corresponding Proxy
  // 根据是否只读，来获取响应的响应式对象收集者（声明在当前文件36行，添加在当前文件249行）
  const proxyMap = isReadonly ? readonlyMap : reactiveMap
  // 判断是否存在代理对象
  const existingProxy = proxyMap.get(target)
  // 如果存在，则使用已代理过的对象，不需要再次proxy代理，以此进行优化
  if (existingProxy) {
    return existingProxy
  }
  // only a whitelist of value types can be observed.
  // 判断要代理的值的类型标签
  const targetType = getTargetType(target)
  // 如果是无效的，则不进行代理，直接返回
  if (targetType === TargetType.INVALID) {
    return target
  }
  // 创建代理
  const proxy = new Proxy(
    target,
    // 判断是否是收集者类型，如果是则使用`collectionHandlers`，如果不是，使用默认的`baseHandlers`
    targetType === TargetType.COLLECTION ? collectionHandlers : baseHandlers
  )
  // 在对应的响应式对象收集者中添加代理过的对象，用以下次使用直接调用，不需要再次代理
  // （声明在当前文件36行，再次使用在当前文件229行）
  proxyMap.set(target, proxy)
  // 返回代理过的对象
  return proxy
}

// 是否是响应式对象
export function isReactive(value: unknown): boolean {
  // 如果是只读对象
  if (isReadonly(value)) {
    // 判断它代理的初始对象是否是响应的
    return isReactive((value as Target)[ReactiveFlags.RAW])
  }
  // 是否存在并且带有"__v_isReactive"属性
  return !!(value && (value as Target)[ReactiveFlags.IS_REACTIVE])
}

// 是否是只读对象
export function isReadonly(value: unknown): boolean {
  // value存在，并且带有"__v_isReadonly"属性
  return !!(value && (value as Target)[ReactiveFlags.IS_READONLY])
}

// 是否代理过
export function isProxy(value: unknown): boolean {
  // 是否是响应式的或者只读的
  return isReactive(value) || isReadonly(value)
}

// 递归返回响应对象中的被代理的原生对象
export function toRaw<T>(observed: T): T {
  return (
    // 一层层递归，最后返回原生的observed
    (observed && toRaw((observed as Target)[ReactiveFlags.RAW])) || observed
  )
}

// 标记为不被代理的对象
export function markRaw<T extends object>(value: T): T {
  // 在value中添加"__v_skip"属性为true，在代理的过程中就会跳过（当前文件72行）
  def(value, ReactiveFlags.SKIP, true)
  return value
}
