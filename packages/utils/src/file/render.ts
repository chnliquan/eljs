import ejs, { Options } from 'ejs'
import Mustache, {
  OpeningAndClosingTags,
  PartialsOrLookupFn,
  RenderOptions,
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
  opts?: RenderTemplateOpts,
) {
  const { type = 'mustache' } = opts || {}

  if (type === 'ejs') {
    return ejs.render(template, data, {
      ...(opts as EjsRenderTemplateOpts).options,
      async: false,
    })
  } else {
    return Mustache.render(
      template,
      data,
      (opts as MustacheRenderTemplateOpts).partials,
      (opts as MustacheRenderTemplateOpts).tagsOrOptions,
    )
  }
}
