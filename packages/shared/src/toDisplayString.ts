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
      ? /*
          interface JSON {
            parse(text: string, reviver?: (this: any, key: string, value: any) => any): any;
            stringify(value: any, replacer?: (this: any, key: string, value: any) => any, space?: string | number): string;
            stringify(value: any, replacer?: (number | string)[] | null, space?: string | number): string;
          }

          JSON.stringify方法，有三个参数
          - 要文本化的对象
          - 过滤器
            - 如果是数组，那么只从序列化对象中取得`key`为数组中的元素的值
            - 如果是函数，那么有两个参数，分别是对象的key和value，需要返回对应的格式化结果
          - 格式化的标准
            - 如果是数字，那么进行2格的缩进（最大值10，超过算10）
            - 如果是字符串，那么使用字符串来进行格式化（最大长度10，超过按前10个算）

          JSON.parse方法，有两个参数
          - 要格式化的json文本
          - 过滤器，是个函数，同JSON.stringify的第二个参数为函数的情况
        */

        JSON.stringify(val, replacer, 2)
      : String(val)
}

const replacer = (_key: string, val: any) => {
  /*
    兼容Map

    const testMap = new Map([
      [1, 2]
    ])
    JSON.stringify(testMap)

    result: {}
  */
  if (isMap(val)) {
    /*
      const mapVal = new Map([
        ['a', 1]
      ])

      return {
        `Map(1)`: {
          `a =>`: 1
        }
      }
    */
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

    result: {}
  */
  } else if (isSet(val)) {
    /*
      const setVal = new Set([1, 2])

      return {
        `Set(2)`: [1, 2]
      }
    */
    return {
      [`Set(${val.size})`]: [...val.values()]
    }
    // 如果是其他对象（也就是，是对象，但是不是Object和Array，类似于RegExp、Date的情况）
  } else if (isObject(val) && !isArray(val) && !isPlainObject(val)) {
    return String(val)
  }
  return val
}
