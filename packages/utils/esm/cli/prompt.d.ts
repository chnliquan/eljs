import prompts, { type Choice, type PromptObject } from 'prompts'
/**
 * 确认问询
 * @param message 闻讯信息
 * @param preferNo 是否默认 false
 * @param onCancel 取消回调函数
 */
export declare function confirm(
  message: string,
  preferNo?: boolean,
  onCancel?: prompts.Options['onCancel'],
): Promise<boolean>
/**
 * 选择问询
 * @param message 问询信息
 * @param choices 问询选项
 * @param initial 问询初始化数据
 */
export declare function select<T extends Choice>(
  message: string,
  choices: T[],
  initial?: PromptObject['initial'],
): Promise<string>
/**
 * 问询
 * @param questions 问询问题列表
 * @param initials 问询初始化数据
 */
export declare function prompt<
  T extends PromptObject,
  U extends Record<string, any>,
>(questions: T[], initials?: U): Promise<U>
/**
 * 循环问询
 * @param questions 问询问题列表
 * @param initials 问询初始化数据
 */
export declare function loopPrompt<
  T extends PromptObject,
  U extends Record<string, any> = Record<string, any>,
>(questions: T[], initials?: U): Promise<U>
//# sourceMappingURL=prompt.d.ts.map
