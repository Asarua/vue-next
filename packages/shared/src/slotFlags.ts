// slot的标记
export const enum SlotFlags {
  /**
   * Stable slots that only reference slot props or context state. The slot
   * can fully capture its own dependencies so when passed down the parent won't
   * need to force the child to update.
   *
   * 稳定的插槽只引用插槽属性和上下文的状态。
   * 这种插槽可以完全覆盖它自己的依赖因此当传递给父组件的时候不需要子组件进行更新。
   */
  STABLE = 1,
  /**
   * Slots that reference scope variables (v-for or an outer slot prop), or
   * has conditional structure (v-if, v-for). The parent will need to force
   * the child to update because the slot does not fully capture its dependencies.
   *
   * 用于引用了局部变量的插槽(比如v-for或者外部slot的属性)，或者拥有条件结构（v-if，v-for）。
   * 父组件需要更新子组件因为插槽没办法完全覆盖它所有的依赖状态
   */
  DYNAMIC = 2,
  /**
   * `<slot/>` being forwarded into a child component. Whether the parent needs
   * to update the child is dependent on what kind of slots the parent itself
   * received. This has to be refined at runtime, when the child's vnode
   * is being created (in `normalizeChildren`)
   *
   * `<slot/>`被转发到一个子组件。父组件是否需要更新子组件取决于父组件自身收到的是什么类型的插槽。
   * 在运行时，当子组件的vnode已经被创建的时候，这将是优雅的
   */
  FORWARDED = 3
}

/**
 * Dev only
 */
export const slotFlagsText = {
  [SlotFlags.STABLE]: 'STABLE',
  [SlotFlags.DYNAMIC]: 'DYNAMIC',
  [SlotFlags.FORWARDED]: 'FORWARDED'
}
