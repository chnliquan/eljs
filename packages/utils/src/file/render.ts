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
 * 渲染模版
 * @param template 模版内容
 * @param data 模版数据
 * @param options 选项
 */
export function renderTemplate(
  template: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
  options?: RenderTemplateOptions,
): string {
  const { type = 'mustache', options: renderOptions } = (options ||
    {}) as EjsRenderTemplateOptions
  const { partials, tagsOrOptions } = (options ||
    {}) as MustacheRenderTemplateOptions

  try {
    if (type === 'ejs') {
      return ejs.render(template, data, {
        ...renderOptions,
        async: false,
      })
    } else {
      return Mustache.render(template, data, partials, tagsOrOptions)
    }
  } catch (error) {
    const err = error as Error
    err.message = `Render ${template} failed: ${err.message}`
    throw err
  }
}
