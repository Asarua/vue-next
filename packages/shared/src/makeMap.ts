/**
 * Make a map and return a function for checking if a key
 * is in that map.
 * IMPORTANT: all calls of this function must be prefixed with
 * \/\*#\_\_PURE\_\_\*\/
 * So that rollup can tree-shake them if necessary.
 */

/**
 * 制造一个字典并且返回一个函数用于校验是否传进来的值在这个字典中
 * !注意： 所有调用这个函数的前面都必须加上\/\*#\_\_PURE\_\_\*\/
 * 这样可以使rollup在不需要他们的时候进行tree-shake
 *
 * @example
 * ```ts
 *  const mapVal = makeMap('a,b,c')
 *  mapVal('a') ——> true
 *  mapVal('d') ——> true
 * ```
 */
export function makeMap(
  str: string,
  // 是否要求小写
  expectsLowerCase?: boolean
): (key: string) => boolean {
  const map: Record<string, boolean> = Object.create(null)
  const list: Array<string> = str.split(',')
  for (let i = 0; i < list.length; i++) {
    map[list[i]] = true
  }
  return expectsLowerCase ? val => !!map[val.toLowerCase()] : val => !!map[val]
}
