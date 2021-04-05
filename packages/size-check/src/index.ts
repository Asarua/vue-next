import { h, createApp } from '@vue/runtime-dom'

// The bare minimum code required for rendering something to the screen
// 要在屏幕上展示一些东西的时候的最小代码使用量
createApp({
  render: () => h('div', 'hello world!')
}).mount('#app')
