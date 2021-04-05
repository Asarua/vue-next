import { isArray, isString, isObject, hyphenate } from './'
import { isNoUnitNumericStyleProp } from './domAttrConfig'

export type NormalizedStyle = Record<string, string | number>

// 正常化样式
export function normalizeStyle(value: unknown): NormalizedStyle | undefined {
  // 如果style中传递的是数组
  if (isArray(value)) {
    const res: Record<string, string | number> = {}
    for (let i = 0; i < value.length; i++) {
      // 取得style数组的每一项
      const item = value[i]
      // 获取正常化的样式对象
      const normalized = normalizeStyle(
        // 在这儿判断一个String，是因为可能item是个表达式的条件
        isString(item) ? parseStringStyle(item) : item
      )
      // 如果存在，保证为真的情况才会被使用
      if (normalized) {
        for (const key in normalized) {
          res[key] = normalized[key]
        }
      }
    }
    return res
    // 如果是对象，直接返回使用
  } else if (isObject(value)) {
    return value
  }
}

// 样式属性分割
const listDelimiterRE = /;(?![^(]*\))/g
// 样式键值对分割
const propertyDelimiterRE = /:(.+)/

// 解析字符串样式
export function parseStringStyle(cssText: string): NormalizedStyle {
  const ret: NormalizedStyle = {}
  // 首先分割每个属性
  cssText.split(listDelimiterRE).forEach(item => {
    if (item) {
      // 分割键值对
      const tmp = item.split(propertyDelimiterRE)
      // 如果正确，那么在对象中添加
      tmp.length > 1 && (ret[tmp[0].trim()] = tmp[1].trim())
    }
  })
  return ret
}

// 将样式对象字符串化
export function stringifyStyle(styles: NormalizedStyle | undefined): string {
  let ret = ''
  // 如果不存在，直接返回空字符串
  if (!styles) {
    return ret
  }
  for (const key in styles) {
    const value = styles[key]
    // key如果不是以`--`开头，那么使用修改连字符的方法进行转化为-形式的
    // @example `onClick` ——> `on-click`
    const normalizedKey = key.startsWith(`--`) ? key : hyphenate(key)
    if (
      // 如果是字符串
      isString(value) ||
      // 获取是值是数字，并且key是接收纯数字的属性
      (typeof value === 'number' && isNoUnitNumericStyleProp(normalizedKey))
    ) {
      // only render valid values
      ret += `${normalizedKey}:${value};`
    }
  }
  return ret
}

// 拼接class属性
export function normalizeClass(value: unknown): string {
  let res = ''
  // 如果是字符串
  if (isString(value)) {
    res = value
    // 如果是数组形式
  } else if (isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      // 递归获取每一项的值
      const normalized = normalizeClass(value[i])
      // 如果存在
      if (normalized) {
        // 进行拼接
        res += normalized + ' '
      }
    }
    // 如果是对象形式
  } else if (isObject(value)) {
    for (const name in value) {
      if (value[name]) {
        res += name + ' '
      }
    }
  }
  return res.trim()
}
