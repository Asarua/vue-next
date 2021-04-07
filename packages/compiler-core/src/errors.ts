import { SourceLocation } from './ast'

export interface CompilerError extends SyntaxError {
  code: number
  loc?: SourceLocation
}

export interface CoreCompilerError extends CompilerError {
  code: ErrorCodes
}

// 默认的错误处理
export function defaultOnError(error: CompilerError) {
  throw error
}

// 错误生成者工厂函数
export function createCompilerError<T extends number>(
  code: T,
  loc?: SourceLocation,
  messages?: { [code: number]: string },
  additionalMessage?: string
): T extends ErrorCodes ? CoreCompilerError : CompilerError {
  const msg =
    __DEV__ || !__BROWSER__
      ? (messages || errorMessages)[code] + (additionalMessage || ``)
      : code
  const error = new SyntaxError(String(msg)) as CompilerError
  error.code = code
  error.loc = loc
  return error as any
}

export const enum ErrorCodes {
  // parse errors
  ABRUPT_CLOSING_OF_EMPTY_COMMENT,
  CDATA_IN_HTML_CONTENT,
  DUPLICATE_ATTRIBUTE,
  END_TAG_WITH_ATTRIBUTES,
  END_TAG_WITH_TRAILING_SOLIDUS,
  EOF_BEFORE_TAG_NAME,
  EOF_IN_CDATA,
  EOF_IN_COMMENT,
  EOF_IN_SCRIPT_HTML_COMMENT_LIKE_TEXT,
  EOF_IN_TAG,
  INCORRECTLY_CLOSED_COMMENT,
  INCORRECTLY_OPENED_COMMENT,
  INVALID_FIRST_CHARACTER_OF_TAG_NAME,
  MISSING_ATTRIBUTE_VALUE,
  MISSING_END_TAG_NAME,
  MISSING_WHITESPACE_BETWEEN_ATTRIBUTES,
  NESTED_COMMENT,
  UNEXPECTED_CHARACTER_IN_ATTRIBUTE_NAME,
  UNEXPECTED_CHARACTER_IN_UNQUOTED_ATTRIBUTE_VALUE,
  UNEXPECTED_EQUALS_SIGN_BEFORE_ATTRIBUTE_NAME,
  UNEXPECTED_NULL_CHARACTER,
  UNEXPECTED_QUESTION_MARK_INSTEAD_OF_TAG_NAME,
  UNEXPECTED_SOLIDUS_IN_TAG,

  // Vue-specific parse errors
  X_INVALID_END_TAG,
  X_MISSING_END_TAG,
  X_MISSING_INTERPOLATION_END,
  X_MISSING_DYNAMIC_DIRECTIVE_ARGUMENT_END,

  // transform errors
  X_V_IF_NO_EXPRESSION,
  X_V_IF_SAME_KEY,
  X_V_ELSE_NO_ADJACENT_IF,
  X_V_FOR_NO_EXPRESSION,
  X_V_FOR_MALFORMED_EXPRESSION,
  X_V_FOR_TEMPLATE_KEY_PLACEMENT,
  X_V_BIND_NO_EXPRESSION,
  X_V_ON_NO_EXPRESSION,
  X_V_SLOT_UNEXPECTED_DIRECTIVE_ON_SLOT_OUTLET,
  X_V_SLOT_MIXED_SLOT_USAGE,
  X_V_SLOT_DUPLICATE_SLOT_NAMES,
  X_V_SLOT_EXTRANEOUS_DEFAULT_SLOT_CHILDREN,
  X_V_SLOT_MISPLACED,
  X_V_MODEL_NO_EXPRESSION,
  X_V_MODEL_MALFORMED_EXPRESSION,
  X_V_MODEL_ON_SCOPE_VARIABLE,
  X_INVALID_EXPRESSION,
  X_KEEP_ALIVE_INVALID_CHILDREN,

  // generic errors
  X_PREFIX_ID_NOT_SUPPORTED,
  X_MODULE_MODE_NOT_SUPPORTED,
  X_CACHE_HANDLER_NOT_SUPPORTED,
  X_SCOPE_ID_NOT_SUPPORTED,

  // Special value for higher-order compilers to pick up the last code
  // to avoid collision of error codes. This should always be kept as the last
  // item.
  __EXTEND_POINT__
}

export const errorMessages: { [code: number]: string } = {
  //! parse errors 编译错误
  // 非法的注释
  [ErrorCodes.ABRUPT_CLOSING_OF_EMPTY_COMMENT]: 'Illegal comment.',
  // CDATA语句只能出现在XML或者XHTML中
  [ErrorCodes.CDATA_IN_HTML_CONTENT]:
    'CDATA section is allowed only in XML context.',
  // 重复属性
  [ErrorCodes.DUPLICATE_ATTRIBUTE]: 'Duplicate attribute.',
  // 结束标签不可以包含属性
  [ErrorCodes.END_TAG_WITH_ATTRIBUTES]: 'End tag cannot have attributes.',
  // 标签中存在非法的/
  [ErrorCodes.END_TAG_WITH_TRAILING_SOLIDUS]: "Illegal '/' in tags.",
  // 标签前无效的结束标记
  [ErrorCodes.EOF_BEFORE_TAG_NAME]: 'Unexpected EOF in tag.',
  // CDATA块中无效的结束标记
  [ErrorCodes.EOF_IN_CDATA]: 'Unexpected EOF in CDATA section.',
  // 注释中无效的结束标记
  [ErrorCodes.EOF_IN_COMMENT]: 'Unexpected EOF in comment.',
  // script中无效的结束标记
  [ErrorCodes.EOF_IN_SCRIPT_HTML_COMMENT_LIKE_TEXT]:
    'Unexpected EOF in script.',
  // 标签中无效的结束标记
  [ErrorCodes.EOF_IN_TAG]: 'Unexpected EOF in tag.',
  // 错误的闭合注释
  [ErrorCodes.INCORRECTLY_CLOSED_COMMENT]: 'Incorrectly closed comment.',
  // 错误的开启注释
  [ErrorCodes.INCORRECTLY_OPENED_COMMENT]: 'Incorrectly opened comment.',
  // 非法的标签名，使用了`&lt;`
  [ErrorCodes.INVALID_FIRST_CHARACTER_OF_TAG_NAME]:
    "Illegal tag name. Use '&lt;' to print '<'.",
  // 丢失属性值
  [ErrorCodes.MISSING_ATTRIBUTE_VALUE]: 'Attribute value was expected.',
  // 丢失结束标签
  [ErrorCodes.MISSING_END_TAG_NAME]: 'End tag name was expected.',
  // 属性之间丢失空白
  [ErrorCodes.MISSING_WHITESPACE_BETWEEN_ATTRIBUTES]:
    'Whitespace was expected.',
  // 注释中非法的<!--
  [ErrorCodes.NESTED_COMMENT]: "Unexpected '<!--' in comment.",
  // 非法的属性名
  [ErrorCodes.UNEXPECTED_CHARACTER_IN_ATTRIBUTE_NAME]:
    'Attribute name cannot contain U+0022 ("), U+0027 (\'), and U+003C (<).',
  // 无效的属性值
  [ErrorCodes.UNEXPECTED_CHARACTER_IN_UNQUOTED_ATTRIBUTE_VALUE]:
    'Unquoted attribute value cannot contain U+0022 ("), U+0027 (\'), U+003C (<), U+003D (=), and U+0060 (`).',
  // 属性名不可以以=开头
  [ErrorCodes.UNEXPECTED_EQUALS_SIGN_BEFORE_ATTRIBUTE_NAME]:
    "Attribute name cannot start with '='.",
  // <?标记只能在xml上下文中使用
  [ErrorCodes.UNEXPECTED_QUESTION_MARK_INSTEAD_OF_TAG_NAME]:
    "'<?' is allowed only in XML context.",
  // 标签中非法的/
  [ErrorCodes.UNEXPECTED_SOLIDUS_IN_TAG]: "Illegal '/' in tags.",

  //! Vue-specific parse errors vue的编译错误
  // 无效的结束标签
  [ErrorCodes.X_INVALID_END_TAG]: 'Invalid end tag.',
  // 丢失结束标签
  [ErrorCodes.X_MISSING_END_TAG]: 'Element is missing end tag.',
  // 找不到插值结束符号
  [ErrorCodes.X_MISSING_INTERPOLATION_END]:
    'Interpolation end sign was not found.',
  // 找不到动态指令结束括号，请注意，动态指令参数不可以包含空格
  [ErrorCodes.X_MISSING_DYNAMIC_DIRECTIVE_ARGUMENT_END]:
    'End bracket for dynamic directive argument was not found. ' +
    'Note that dynamic directive argument cannot contain spaces.',

  //! transform errors 转换错误
  // 丢失v-if或者v-else-if语句，出现在只使用了v-else的情况
  [ErrorCodes.X_V_IF_NO_EXPRESSION]: `v-if/v-else-if is missing expression.`,
  // v-if相关语句中不可以使用相同的key
  [ErrorCodes.X_V_IF_SAME_KEY]: `v-if/else branches must use unique keys.`,
  // v-else/v-else-if语句中没有相邻的v-if
  [ErrorCodes.X_V_ELSE_NO_ADJACENT_IF]: `v-else/v-else-if has no adjacent v-if.`,
  // v-for中丢失了语句
  [ErrorCodes.X_V_FOR_NO_EXPRESSION]: `v-for is missing expression.`,
  // v-for中存在无效语句
  [ErrorCodes.X_V_FOR_MALFORMED_EXPRESSION]: `v-for has invalid expression.`,
  // 模板中的v-for的key应该放在template标签中
  [ErrorCodes.X_V_FOR_TEMPLATE_KEY_PLACEMENT]: `<template v-for> key should be placed on the <template> tag.`,
  // v-bind丢失语句
  [ErrorCodes.X_V_BIND_NO_EXPRESSION]: `v-bind is missing expression.`,
  // v-on丢失语句
  [ErrorCodes.X_V_ON_NO_EXPRESSION]: `v-on is missing expression.`,
  // 在<slot>外面存在无效的自定义指令
  [ErrorCodes.X_V_SLOT_UNEXPECTED_DIRECTIVE_ON_SLOT_OUTLET]: `Unexpected custom directive on <slot> outlet.`,
  // 在组件和嵌套template中混合使用了v-slot
  [ErrorCodes.X_V_SLOT_MIXED_SLOT_USAGE]:
    `Mixed v-slot usage on both the component and nested <template>.` +
    `When there are multiple named slots, all slots should use <template> ` +
    `syntax to avoid scope ambiguity.`,
  // 出现了重复的slot name
  [ErrorCodes.X_V_SLOT_DUPLICATE_SLOT_NAMES]: `Duplicate slot names found. `,
  // 在命名插槽中找到了无效的子元素
  [ErrorCodes.X_V_SLOT_EXTRANEOUS_DEFAULT_SLOT_CHILDREN]:
    `Extraneous children found when component already has explicitly named ` +
    `default slot. These children will be ignored.`,
  // v-slot只可以在组件或者template标签中
  [ErrorCodes.X_V_SLOT_MISPLACED]: `v-slot can only be used on components or <template> tags.`,
  // v-model丢失语句
  [ErrorCodes.X_V_MODEL_NO_EXPRESSION]: `v-model is missing expression.`,
  // v-model的值必须是一个有效的js语句
  [ErrorCodes.X_V_MODEL_MALFORMED_EXPRESSION]: `v-model value must be a valid JavaScript member expression.`,
  // v-model不可以使用v-for或者v-slot作用域的变量，因为他们是只读的
  [ErrorCodes.X_V_MODEL_ON_SCOPE_VARIABLE]: `v-model cannot be used on v-for or v-slot scope variables because they are not writable.`,
  // 错误的js语句
  [ErrorCodes.X_INVALID_EXPRESSION]: `Error parsing JavaScript expression: `,
  // keepalive中出现了多个子组件
  [ErrorCodes.X_KEEP_ALIVE_INVALID_CHILDREN]: `<KeepAlive> expects exactly one child component.`,

  //! generic errors 生成错误
  // 前缀标识符在这个编译版本中不支持
  [ErrorCodes.X_PREFIX_ID_NOT_SUPPORTED]: `"prefixIdentifiers" option is not supported in this build of compiler.`,
  // es module在这个编译构建中不支持
  [ErrorCodes.X_MODULE_MODE_NOT_SUPPORTED]: `ES module mode is not supported in this build of compiler.`,
  // 缓存擦欧总选项只有在前缀标识符选项开启的状态下才支持
  [ErrorCodes.X_CACHE_HANDLER_NOT_SUPPORTED]: `"cacheHandlers" option is only supported when the "prefixIdentifiers" option is enabled.`,
  // scopeId选项只有在module模式中才支持
  [ErrorCodes.X_SCOPE_ID_NOT_SUPPORTED]: `"scopeId" option is only supported in module mode.`
}
