import { makeMap } from './makeMap'

export { makeMap }
export * from './patchFlags'
export * from './shapeFlags'
export * from './slotFlags'
export * from './globalsWhitelist'
export * from './codeframe'
export * from './normalizeProp'
export * from './domTagConfig'
export * from './domAttrConfig'
export * from './escapeHtml'
export * from './looseEqual'
export * from './toDisplayString'

/**
 * List of @babel/parser plugins that are used for template expression
 * transforms and SFC script transforms. By default we enable proposals slated
 * for ES2020. This will need to be updated as the spec moves forward.
 * Full list at https://babeljs.io/docs/en/next/babel-parser#plugins
 */
// babel 默认的插件配置
export const babelParserDefaultPlugins = [
  // bigInt 第七种基本数据类型
  'bigInt',
  // 可选链 a?.b
  'optionalChaining',
  // 空值合并运算符 a ?? b
  'nullishCoalescingOperator'
] as const

/*
  Object.freeze设置后的对象，会保存现有的对象属性，
  但是所有的属性的`writable`和`configurable`都会变为false
*/
// 空对象
export const EMPTY_OBJ: { readonly [key: string]: any } = __DEV__
  ? Object.freeze({})
  : {}
// 空数组
export const EMPTY_ARR = __DEV__ ? Object.freeze([]) : []

// 空函数
export const NOOP = () => {}

/**
 * Always return false.
 * 总是返回false
 */
export const NO = () => false

// 事件正则
const onRE = /^on[^a-z]/
// 用于判断某个key是否是事件
export const isOn = (key: string) => onRE.test(key)

// 是否是模块监听
export const isModelListener = (key: string) => key.startsWith('onUpdate:')

// 合并对象
export const extend = Object.assign

// 在数组中移除某项
export const remove = <T>(arr: T[], el: T) => {
  const i = arr.indexOf(el)
  if (i > -1) {
    arr.splice(i, 1)
  }
}

// 是否在对象本身中存在某个属性
const hasOwnProperty = Object.prototype.hasOwnProperty
// 是否存在属性
export const hasOwn = (
  val: object,
  key: string | symbol
): key is keyof typeof val => hasOwnProperty.call(val, key)

// 是否是数组
export const isArray = Array.isArray
// 是否是Map
export const isMap = (val: unknown): val is Map<any, any> =>
  toTypeString(val) === '[object Map]'
// 是否是Set
export const isSet = (val: unknown): val is Set<any> =>
  toTypeString(val) === '[object Set]'

// 是否是Date
export const isDate = (val: unknown): val is Date => val instanceof Date
// 是否是函数
export const isFunction = (val: unknown): val is Function =>
  typeof val === 'function'
// 是否字符串
export const isString = (val: unknown): val is string => typeof val === 'string'
// 是否是Symbol
export const isSymbol = (val: unknown): val is symbol => typeof val === 'symbol'
// 是否是对象
export const isObject = (val: unknown): val is Record<any, any> =>
  val !== null && typeof val === 'object'

// 是否是Promise
export const isPromise = <T = any>(val: unknown): val is Promise<T> => {
  return isObject(val) && isFunction(val.then) && isFunction(val.catch)
}

export const objectToString = Object.prototype.toString
export const toTypeString = (value: unknown): string =>
  objectToString.call(value)

/*
  获取数据类型

  const date = new Date()
  toTypeString(date) // `[object Date]`
  toRawType(date) // `Date`
*/
export const toRawType = (value: unknown): string => {
  // extract "RawType" from strings like "[object RawType]"
  return toTypeString(value).slice(8, -1)
}

// 是否是常规对象
export const isPlainObject = (val: unknown): val is object =>
  toTypeString(val) === '[object Object]'

// key是否是正整数
export const isIntegerKey = (key: unknown) =>
  isString(key) &&
  key !== 'NaN' &&
  key[0] !== '-' &&
  '' + parseInt(key, 10) === key

// props保留字
export const isReservedProp = /*#__PURE__*/ makeMap(
  // the leading comma is intentional so empty string "" is also included
  ',key,ref,' +
    'onVnodeBeforeMount,onVnodeMounted,' +
    'onVnodeBeforeUpdate,onVnodeUpdated,' +
    'onVnodeBeforeUnmount,onVnodeUnmounted'
)

// 缓存对字符串进行操作的方法（代理模式 -> 缓存代理）
// 缓存代理可以为一些开销大的运算结果提供暂时的存储，在下次运算时，
// 如果传递进来的参数跟之前的一致，则可以直接返回前面存储的运算结果
const cacheStringFunction = <T extends (str: string) => string>(fn: T): T => {
  const cache: Record<string, string> = Object.create(null)
  return ((str: string) => {
    const hit = cache[str]
    return hit || (cache[str] = fn(str))
  }) as any
}

const camelizeRE = /-(\w)/g
/**
 * @private 将连字符改为小驼峰
 */
export const camelize = cacheStringFunction(
  (str: string): string => {
    return str.replace(camelizeRE, (_, c) => (c ? c.toUpperCase() : ''))
  }
)

const hyphenateRE = /\B([A-Z])/g
/**
 * @private 将驼峰改为连字符
 * const a = 'onClick'
 * ——> on-click
 */
export const hyphenate = cacheStringFunction((str: string) =>
  str.replace(hyphenateRE, '-$1').toLowerCase()
)

/**
 * @private 首字母大写
 */
export const capitalize = cacheStringFunction(
  (str: string) => str.charAt(0).toUpperCase() + str.slice(1)
)

/**
 * @private 回调事件
 */
export const toHandlerKey = cacheStringFunction(
  (str: string) => (str ? `on${capitalize(str)}` : ``)
)

// compare whether a value has changed, accounting for NaN.
// 值是否发生改变，后面的用于处理NaN
export const hasChanged = (value: any, oldValue: any): boolean =>
  value !== oldValue && (value === value || oldValue === oldValue)

// 调用要处理同一逻辑的由函数组成的数组
export const invokeArrayFns = (fns: Function[], arg?: any) => {
  for (let i = 0; i < fns.length; i++) {
    fns[i](arg)
  }
}

// 使用Object.defineProperty定义属性的特殊状态
export const def = (obj: object, key: string | symbol, value: any) => {
  Object.defineProperty(obj, key, {
    configurable: true,
    enumerable: false,
    value
  })
}

// 转化number类型
export const toNumber = (val: any): any => {
  const n = parseFloat(val)
  return isNaN(n) ? val : n
}

// 使用闭包保存globalThis对象
let _globalThis: any
// 获取global对象
export const getGlobalThis = (): any => {
  return (
    // 第一次是undefined，第二次开始，就会使用保存的_globalThis
    _globalThis ||
    (_globalThis =
      // ecma最新标准的globalThis
      typeof globalThis !== 'undefined'
        ? globalThis
        : // webworker环境
          typeof self !== 'undefined'
          ? self
          : // 浏览器环境
            typeof window !== 'undefined'
            ? window
            : // node
              typeof global !== 'undefined'
              ? global
              : {})
  )
}
