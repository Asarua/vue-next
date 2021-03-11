// 判断是否存在yarn的环境，因为`vue3`的开发环境选择的是`monorepo`架构，选取了`yarn` + `workspace`的方式
if (!/yarn\.js$/.test(process.env.npm_execpath || '')) {
  console.warn(
    '\u001b[33mThis repository requires Yarn 1.x for scripts to work properly.\u001b[39m\n'
  )
  process.exit(1)
}
