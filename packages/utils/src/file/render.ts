import ejs, { type Options } from 'ejs'
import Mustache, {
  type OpeningAndClosingTags,
  type PartialsOrLookupFn,
  type RenderOptions,
} from 'mustache'

/**
 * 模版渲染选项
 */
export type RenderTemplateOptions =
  | MustacheRenderTemplateOptions
  | EjsRenderTemplateOptions

/**
 * mustache 模版渲染选项
 */
export interface MustacheRenderTemplateOptions {
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
export interface EjsRenderTemplateOptions {
  type?: 'ejs'
  options?: Options
}

/**
 * 渲染模版字符串
 * @param template 模版内容
 * @param data 模版数据
 * @param options 可选配置项
 */
export function renderTemplate(
  template: string,
  data: Record<string, unknown>,
  options: RenderTemplateOptions = {},
): string {
  const { type = 'mustache', options: renderOptions } =
    options as EjsRenderTemplateOptions
  const { partials, tagsOrOptions } = options as MustacheRenderTemplateOptions

  if (type === 'ejs') {
    return ejs.render(template, data, {
      ...renderOptions,
      async: false,
    })
  } else {
    return Mustache.render(template, data, partials, tagsOrOptions)
  }
}
