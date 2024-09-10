import ejs, { type Options } from 'ejs'
import Mustache, {
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
export function renderTemplate(
  template: string,
  data: Record<string, unknown>,
  opts: RenderTemplateOpts = {},
): string {
  const { type = 'mustache', options } = opts as EjsRenderTemplateOpts
  const { partials, tagsOrOptions } = opts as MustacheRenderTemplateOpts

  if (type === 'ejs') {
    return ejs.render(template, data, {
      ...options,
      async: false,
    })
  } else {
    return Mustache.render(template, data, partials, tagsOrOptions)
  }
}
