import { TrackOpTypes, TriggerOpTypes } from './operations'
import { EMPTY_OBJ, isArray, isIntegerKey, isMap } from '@vue/shared'

// The main WeakMap that stores {target -> key -> dep} connections.
// Conceptually, it's easier to think of a dependency as a Dep class
// which maintains a Set of subscribers, but we simply store them as
// raw Sets to reduce memory overhead.
type Dep = Set<ReactiveEffect>
type KeyToDepMap = Map<any, Dep>
/*
  响应式依赖收集者的数据结构
  new WeakMap([
    [
      target, // 每一个被监听的对象
      new Map([ // 依赖收集
        [
          'xxx', 每个被观察的属性
          Set // 要触发的列表
        ]
      ])
    ]
  ])
*/
const targetMap = new WeakMap<any, KeyToDepMap>()

// 响应式的副作用
export interface ReactiveEffect<T = any> {
  (): T
  _isEffect: true
  id: number
  active: boolean
  raw: () => T
  deps: Array<Dep>
  options: ReactiveEffectOptions
  allowRecurse: boolean
}

// 副作用函数的配置项
export interface ReactiveEffectOptions {
  lazy?: boolean
  scheduler?: (job: ReactiveEffect) => void
  onTrack?: (event: DebuggerEvent) => void
  onTrigger?: (event: DebuggerEvent) => void
  onStop?: () => void
  allowRecurse?: boolean
}

// debug的时候的相关属性
export type DebuggerEvent = {
  effect: ReactiveEffect
  target: object
  type: TrackOpTypes | TriggerOpTypes
  key: any
} & DebuggerEventExtraInfo

export interface DebuggerEventExtraInfo {
  newValue?: any
  oldValue?: any
  oldTarget?: Map<any, any> | Set<any>
}

// 要触发的响应事件的列表
const effectStack: ReactiveEffect[] = []
// 当前副作用
let activeEffect: ReactiveEffect | undefined

export const ITERATE_KEY = Symbol(__DEV__ ? 'iterate' : '')
export const MAP_KEY_ITERATE_KEY = Symbol(__DEV__ ? 'Map key iterate' : '')

// 判断是否是副作用函数
export function isEffect(fn: any): fn is ReactiveEffect {
  return fn && fn._isEffect === true
}

// 副作用函数
export function effect<T = any>(
  fn: () => T,
  options: ReactiveEffectOptions = EMPTY_OBJ
): ReactiveEffect<T> {
  // 如果是副作用函数
  if (isEffect(fn)) {
    // 那么使用它未被包裹的方法
    fn = fn.raw
  }
  const effect = createReactiveEffect(fn, options)
  // 如果不是懒加载的
  if (!options.lazy) {
    // 首先执行一次
    effect()
  }
  return effect
}

export function stop(effect: ReactiveEffect) {
  if (effect.active) {
    cleanup(effect)
    if (effect.options.onStop) {
      effect.options.onStop()
    }
    effect.active = false
  }
}

// 副作用函数标识符
let uid = 0

// 创建响应式副作用函数
function createReactiveEffect<T = any>(
  fn: () => T,
  options: ReactiveEffectOptions
): ReactiveEffect<T> {
  // 创建包裹函数（注意，是一个函数体，并不执行，所以可以先不考虑里面的方法）
  const effect = function reactiveEffect(): unknown {
    // 如果不是激活状态（发生在触发stop方法之后）
    if (!effect.active) {
      // 如果有调度器，返回undefined，否则返回普通的函数执行结果
      return options.scheduler ? undefined : fn()
    }
    // 判断当前副作用函数执行栈中是否存在当前函数，防止造成死循环
    if (!effectStack.includes(effect)) {
      // 如果不在当前执行栈
      // 清除依赖，因为每次执行都会重新收集依赖，所以需要清除
      cleanup(effect)
      try {
        // 允许收集依赖
        enableTracking()
        // 将当前副作用函数添加到执行栈
        effectStack.push(effect)
        // 设置当前副作用函数为执行状态
        activeEffect = effect
        return fn()
      } finally {
        // 执行结束之后
        // 将当前副作用函数从执行栈中清除
        effectStack.pop()
        // 重置依赖收集
        resetTracking()
        // 恢复执行函数
        activeEffect = effectStack[effectStack.length - 1]
      }
    }
  } as ReactiveEffect
  // 自增标识符
  effect.id = uid++
  // 允许递归调用
  effect.allowRecurse = !!options.allowRecurse
  // 是否是副作用函数
  effect._isEffect = true
  // 是否响应
  effect.active = true
  // 初始值
  effect.raw = fn
  // 依赖
  effect.deps = []
  // 传递的参数
  effect.options = options
  return effect
}

// 清除响应
function cleanup(effect: ReactiveEffect) {
  // 获取传入的响应式函数中的依赖列表
  const { deps } = effect
  // 如果存在
  if (deps.length) {
    for (let i = 0; i < deps.length; i++) {
      // 清除
      deps[i].delete(effect)
    }
    deps.length = 0
  }
}

let shouldTrack = true
const trackStack: boolean[] = []

export function pauseTracking() {
  trackStack.push(shouldTrack)
  shouldTrack = false
}

export function enableTracking() {
  trackStack.push(shouldTrack)
  shouldTrack = true
}

export function resetTracking() {
  const last = trackStack.pop()
  shouldTrack = last === undefined ? true : last
}

/**
 * 依赖收集
 * @param target 被代理的响应式对象
 * @param type 依赖于哪种操作
 * @param key 依赖哪个值
 * @returns
 */
export function track(target: object, type: TrackOpTypes, key: unknown) {
  // 如果是不需要添加收集依赖或者当前没有响应式的副作用函数，直接返回
  if (!shouldTrack || activeEffect === undefined) {
    return
  }
  // 查找是否有依赖项
  let depsMap = targetMap.get(target)
  // 如果不存在
  if (!depsMap) {
    // 添加依赖收集者
    targetMap.set(target, (depsMap = new Map()))
  }
  // 查询是否存在当前依赖的值
  let dep = depsMap.get(key)
  // 如果不存在
  if (!dep) {
    // 添加对当前值的依赖收集列表
    depsMap.set(key, (dep = new Set()))
  }
  // 如果当前值的收集者列表中不存在当前响应的副作用函数
  if (!dep.has(activeEffect)) {
    // 添加
    dep.add(activeEffect)
    // 要触发的依赖中添加当前列表
    activeEffect.deps.push(dep)
    // 如果是开发环境，并且存在自定义onTrack方法
    if (__DEV__ && activeEffect.options.onTrack) {
      // 执行自定义track
      activeEffect.options.onTrack({
        effect: activeEffect,
        target,
        type,
        key
      })
    }
  }
}

// 触发器
export function trigger(
  target: object,
  type: TriggerOpTypes,
  key?: unknown,
  newValue?: unknown,
  oldValue?: unknown,
  oldTarget?: Map<unknown, unknown> | Set<unknown>
) {
  // 查找是否存在响应依赖
  const depsMap = targetMap.get(target)
  // 如果不存在
  if (!depsMap) {
    // never been tracked
    // 说明不是响应依赖，直接返回
    return
  }

  // 本次要执行的副作用函数列表
  const effects = new Set<ReactiveEffect>()
  // 向副作用函数列表中添加值的方法
  const add = (effectsToAdd: Set<ReactiveEffect> | undefined) => {
    // 如果存在副作用列表
    if (effectsToAdd) {
      // Set.forEach
      effectsToAdd.forEach(effect => {
        // 如果当前项不是正在触发的项，或者副作用函数被设置为允许递归执行
        if (effect !== activeEffect || effect.allowRecurse) {
          // 在列表中添加
          effects.add(effect)
        }
      })
    }
  }

  // 如果触发的是clear
  if (type === TriggerOpTypes.CLEAR) {
    // collection being cleared
    // trigger all effects for target
    // 将所有的当前响应对象的副作用函数，全部进行添加
    depsMap.forEach(add)
    // 如果查询的是数组的length
  } else if (key === 'length' && isArray(target)) {
    depsMap.forEach((dep, key) => {
      // 如果找到length或者 // TODO
      if (key === 'length' || key >= (newValue as number)) {
        // 添加
        add(dep)
      }
    })
  } else {
    // schedule runs for SET | ADD | DELETE
    // 如果key存在
    if (key !== void 0) {
      // 那么添加当前key的所有副作用函数
      add(depsMap.get(key))
    }

    // also run for iteration key on ADD | DELETE | Map.SET
    // 同时执行比如add、delete、set之类的迭代属性
    switch (type) {
      // 如果是add
      case TriggerOpTypes.ADD:
        if (!isArray(target)) {
          add(depsMap.get(ITERATE_KEY))
          if (isMap(target)) {
            add(depsMap.get(MAP_KEY_ITERATE_KEY))
          }
        } else if (isIntegerKey(key)) {
          // new index added to array -> length changes
          add(depsMap.get('length'))
        }
        break
      case TriggerOpTypes.DELETE:
        if (!isArray(target)) {
          add(depsMap.get(ITERATE_KEY))
          if (isMap(target)) {
            add(depsMap.get(MAP_KEY_ITERATE_KEY))
          }
        }
        break
      case TriggerOpTypes.SET:
        if (isMap(target)) {
          add(depsMap.get(ITERATE_KEY))
        }
        break
    }
  }

  const run = (effect: ReactiveEffect) => {
    if (__DEV__ && effect.options.onTrigger) {
      effect.options.onTrigger({
        effect,
        target,
        key,
        type,
        newValue,
        oldValue,
        oldTarget
      })
    }
    if (effect.options.scheduler) {
      effect.options.scheduler(effect)
    } else {
      effect()
    }
  }

  effects.forEach(run)
}
