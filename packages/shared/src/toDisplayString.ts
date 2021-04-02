import { isArray, isMap, isObject, isPlainObject, isSet } from './index'

/**
 * For converting {{ interpolation }} values to displayed strings.
 * 一个兼容所有类型的toString方法
 * @private
 */
export const toDisplayString = (val: unknown): string => {
  return val == null
    ? ''
    : isObject(val)
      ? JSON.stringify(val, replacer, 2)
      : String(val)
}

const replacer = (_key: string, val: any) => {
  /*
    兼容Map

    const testMap = new Map([
      [1, 2]
    ])
    JSON.stringify(testMap)

    //@result {}
  */
  if (isMap(val)) {
    return {
      [`Map(${val.size})`]: [...val.entries()].reduce((entries, [key, val]) => {
        ;(entries as any)[`${key} =>`] = val
        return entries
      }, {})
    }
    /*
    兼容Set

    const testSet = new Set([1, 2, 3])
    JSON.stringify(testSet)

    //@result {}
  */
  } else if (isSet(val)) {
    return {
      [`Set(${val.size})`]: [...val.values()]
    }
    // 如果是其他对象（也就是，是对象，但是不是Object和Array，类似于RegExp、Date的情况）
  } else if (isObject(val) && !isArray(val) && !isPlainObject(val)) {
    return String(val)
  }
  return val
}
