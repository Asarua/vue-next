const range: number = 2

/**
 * 生成代码结构，用于错误提示
 * 
 * @example
 * ```ts
    const tem = `
      <div>
        <template key="one"></template>
        <ul>
          <li v-for="foobar">hi</li>
        </ul>
        <template key="two"></template>
      </div>
    `
    generateCodeFrame(tem)

    @result
    1 |  
      |  ^
    2 |  <div>
      |  ^^^^^
    3 |    <template key="one"></template>
      |  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    4 |    <ul>
      |  ^^^^^^
    5 |      <li v-for="foobar">hi</li>
      |  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    6 |    </ul>
      |  ^^^^^^^
    7 |    <template key="two"></template>
      |  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    8 |  </div>
      |  ^^^^^^
    9 |      
      |  ^^^^
 * ```
 */
export function generateCodeFrame(
  // 源代码
  source: string,
  // 开始的行数
  start = 0,
  // 结束的行数
  end = source.length
): string {
  const lines = source.split(/\r?\n/)
  let count = 0
  const res: string[] = []
  for (let i = 0; i < lines.length; i++) {
    count += lines[i].length + 1
    if (count >= start) {
      for (let j = i - range; j <= i + range || end > count; j++) {
        if (j < 0 || j >= lines.length) continue
        const line = j + 1
        res.push(
          `${line}${' '.repeat(Math.max(3 - String(line).length, 0))}|  ${
            lines[j]
          }`
        )
        const lineLength = lines[j].length
        if (j === i) {
          // push underline
          const pad = start - (count - lineLength) + 1
          const length = Math.max(
            1,
            end > count ? lineLength - pad : end - start
          )
          res.push(`   |  ` + ' '.repeat(pad) + '^'.repeat(length))
        } else if (j > i) {
          if (end > count) {
            const length = Math.max(Math.min(end - count, lineLength), 1)
            res.push(`   |  ` + '^'.repeat(length))
          }
          count += lineLength + 1
        }
      }
      break
    }
  }
  return res.join('\n')
}
