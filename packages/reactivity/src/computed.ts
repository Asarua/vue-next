import { effect, ReactiveEffect, trigger, track } from './effect'
import { TriggerOpTypes, TrackOpTypes } from './operations'
import { Ref } from './ref'
import { isFunction, NOOP } from '@vue/shared'
import { ReactiveFlags, toRaw } from './reactive'

// 计算属性类型
export interface ComputedRef<T = any> extends WritableComputedRef<T> {
  // 将value覆盖为只读属性
  readonly value: T
}

// 如果是可写入计算属性
export interface WritableComputedRef<T> extends Ref<T> {
  // 添加副作用函数用于响应
  readonly effect: ReactiveEffect<T>
}

export type ComputedGetter<T> = (ctx?: any) => T
export type ComputedSetter<T> = (v: T) => void

export interface WritableComputedOptions<T> {
  get: ComputedGetter<T>
  set: ComputedSetter<T>
}

// 计算属性实体类
class ComputedRefImpl<T> {
  private _value!: T
  // 用来标识是否需要重新计算值，默认需要重新计算
  private _dirty = true

  public readonly effect: ReactiveEffect<T>

  public readonly __v_isRef = true;
  public readonly [ReactiveFlags.IS_READONLY]: boolean

  constructor(
    getter: ComputedGetter<T>,
    private readonly _setter: ComputedSetter<T>,
    isReadonly: boolean
  ) {
    // 对传递进来对getter进行依赖收集
    this.effect = effect(getter, {
      lazy: true,
      scheduler: () => {
        // 如果是依赖于缓存的值
        if (!this._dirty) {
          this._dirty = true
          trigger(toRaw(this), TriggerOpTypes.SET, 'value')
        }
      }
    })

    this[ReactiveFlags.IS_READONLY] = isReadonly
  }

  get value() {
    // 如果需要重新计算值
    if (this._dirty) {
      // 再次进行计算
      this._value = this.effect()
      this._dirty = false
    }
    // 添加依赖追踪
    track(toRaw(this), TrackOpTypes.GET, 'value')
    return this._value
  }

  set value(newValue: T) {
    this._setter(newValue)
  }
}

// 重载创建computed函数
// 方式1: 传递一个getter函数
// exp: const a = computed(() => xxx)
export function computed<T>(getter: ComputedGetter<T>): ComputedRef<T>
// 方式2: 传递一个option，里面有get和set两个函数
/*
  exp: const a = computed({
    get() {},
    set(v) {}
  })
*/
export function computed<T>(
  options: WritableComputedOptions<T>
): WritableComputedRef<T>
export function computed<T>(
  getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>
) {
  let getter: ComputedGetter<T>
  let setter: ComputedSetter<T>

  // 如果传递的是一个函数
  if (isFunction(getterOrOptions)) {
    // 那么这个函数就是getter
    getter = getterOrOptions
    setter = __DEV__
      ? () => {
          console.warn('Write operation failed: computed value is readonly')
        }
      : NOOP
  } else {
    // 否则使用传递进来的get和set
    getter = getterOrOptions.get
    setter = getterOrOptions.set
  }

  // 创建计算属性实例
  return new ComputedRefImpl(
    getter,
    setter,
    isFunction(getterOrOptions) || !getterOrOptions.set
  ) as any
}
