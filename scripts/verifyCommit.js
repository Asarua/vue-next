// Invoked on the commit-msg git hook by yorkie.
//* 校验`commit`的时候提交的信息，格式必须是类似于:
//! feat(xxx): xxx
// angular规范

const chalk = require('chalk') // node输出彩色的字体
const msgPath = process.env.GIT_PARAMS // GIT_PARAMS参数依赖于yorkie，能获取到暂存的commit信息的地址
const msg = require('fs') // 获取commit的信息
  .readFileSync(msgPath, 'utf-8')
  .trim()

// commit 提交规范的正则
const commitRE = /^(revert: )?(feat|fix|docs|dx|style|refactor|perf|test|workflow|build|ci|chore|types|wip|release)(\(.+\))?: .{1,50}/

// 如果commit的信息不符合规范
if (!commitRE.test(msg)) {
  console.log()
  console.error(
    `  ${chalk.bgRed.white(' ERROR ')} ${chalk.red(
      `invalid commit message format.`
    )}\n\n` +
      chalk.red(
        `  Proper commit message format is required for automated changelog generation. Examples:\n\n`
      ) +
      `    ${chalk.green(`feat(compiler): add 'comments' option`)}\n` +
      `    ${chalk.green(
        `fix(v-model): handle events on blur (close #28)`
      )}\n\n` +
      chalk.red(`  See .github/commit-convention.md for more details.\n`)
  )
  process.exit(1)
}
