# `json`文件不让写注释，因此我新建一个md文件来描述

```js
{
  "private": true, // 与`workspaces`配合，开启monorepo模式
  "version": "3.0.7", // 版本号
  "workspaces": [ // 工作区
    "packages/*"
  ],
  "scripts": { // 可以执行的脚本
    "dev": "node scripts/dev.js", // 执行scripts文件夹下面的dev.js脚本
    "build": "node scripts/build.js", // 执行scripts文件夹下面的build.js脚本
    "size": "node scripts/build.js vue runtime-dom size-check -p -f global", // 查看vue和runtime-dom运行时的大小，应该是为了优化运行时
    "lint": "eslint --ext .ts packages/*/src/**", // 执行eslint校验代码规范
    "format": "prettier --write --parser typescript \"packages/**/*.ts?(x)\"", // 格式化所有ts或tsx代码
    "test": "node scripts/build.js vue -f global -d && jest --runInBand", // 单元测试
    "test-dts": "node scripts/build.js shared reactivity runtime-core runtime-dom -dt -f esm-bundler && yarn test-dts-only",
    "test-dts-only": "tsc -p ./test-dts/tsconfig.json && tsc -p ./test-dts/tsconfig.build.json",
    "release": "node scripts/release.js", // 执行scripts文件夹下面的release脚本
    "changelog": "conventional-changelog -p angular -i CHANGELOG.md -s", // 生成CHANGELOG.md文件
    "dev-compiler": "npm-run-all --parallel \"dev template-explorer\" serve",
    "serve": "serve",
    "open": "open http://localhost:5000/packages/template-explorer/local.html",
    "preinstall": "node ./scripts/checkYarn.js" // 执行scripts文件夹下的checkYarn脚本，判断是否存在yarn的环境
  },
  "types": "test-dts/index.d.ts", // 类型文件
  "tsd": {
    "directory": "test-dts"
  },
  "gitHooks": { // 提交代码的时候进行的校验
    "pre-commit": "lint-staged", // commit 之前进行eslint校验以及prettier格式的规范化
    "commit-msg": "node scripts/verifyCommit.js" // 校验commit信息
  },
  "lint-staged": { // pre-commit执行的操作
    "*.js": [
      "prettier --write"
    ],
    "*.ts?(x)": [
      "eslint",
      "prettier --parser=typescript --write"
    ]
  },
  "engines": { // 环境
    "node": ">=10.0.0"
  },
  "devDependencies": { // 开发依赖
    "@babel/types": "^7.12.0",
    "@microsoft/api-extractor": "^7.12.1",
    "@rollup/plugin-commonjs": "^17.0.0",
    "@rollup/plugin-json": "^4.0.0",
    "@rollup/plugin-node-resolve": "^11.0.0",
    "@rollup/plugin-replace": "^2.3.4",
    "@types/hash-sum": "^1.0.0",
    "@types/jest": "^26.0.16",
    "@types/node": "^14.10.1",
    "@types/puppeteer": "^2.0.0",
    "@typescript-eslint/parser": "^4.1.1",
    "brotli": "^1.3.2",
    "chalk": "^4.1.0", // node命令行输出彩色字体
    "conventional-changelog-cli": "^2.0.31", // 生成CHANGELOG.md的脚本
    "csstype": "^3.0.3",
    "enquirer": "^2.3.2",
    "eslint": "^7.7.0", // 代码规范校验
    "execa": "^4.0.2",
    "fs-extra": "^9.0.1",
    "jest": "^26.0.1", // 单元测试
    "lint-staged": "^10.2.10", // 配合git hook进行提交校验
    "minimist": "^1.2.0",
    "npm-run-all": "^4.1.5",
    "prettier": "~1.14.0", // 代码格式
    "puppeteer": "^2.0.0",
    "rollup": "~2.38.5", // 打包工具
    "rollup-plugin-node-builtins": "^2.1.2",
    "rollup-plugin-node-globals": "^1.4.0",
    "rollup-plugin-terser": "^7.0.2",
    "rollup-plugin-typescript2": "^0.27.2",
    "semver": "^7.3.2",
    "serve": "^11.3.0",
    "ts-jest": "^26.2.0",
    "typescript": "^4.2.2",
    "yorkie": "^2.0.0" // 尤雨溪自己fork的husky改写的一个校验git提交的工具
  }
}

```
