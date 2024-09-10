import { type Options } from 'ejs'
import {
  type OpeningAndClosingTags,
  type PartialsOrLookupFn,
  type RenderOptions,
} from 'mustache'
/**
 * 模版渲染选项
 */
export type RenderTemplateOpts =
  | MustacheRenderTemplateOpts
  | EjsRenderTemplateOpts
/**
 * mustache 模版渲染选项
 */
export interface MustacheRenderTemplateOpts {
  /**
   * 模版渲染器类型
   */
  type?: 'mustache'
  partials?: PartialsOrLookupFn
  tagsOrOptions?: OpeningAndClosingTags | RenderOptions
}
/**
 * ejs 模版渲染选项
 */
export interface EjsRenderTemplateOpts {
  type?: 'ejs'
  options?: Options
}
/**
 * 渲染模版字符串
 * @param template 模版内容
 * @param data 模版填充数据
 * @param opts 模版渲染选项
 */
export declare function renderTemplate(
  template: string,
  data: Record<string, unknown>,
  opts?: RenderTemplateOpts,
): string
//# sourceMappingURL=render.d.ts.map
