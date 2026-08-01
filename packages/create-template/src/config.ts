/**
 * 远程模版
 */
export interface RemoteTemplate {
  /**
   * 模版类型
   */
  type: 'npm' | 'git' | 'local'
  /**
   * 模版值
   */
  value: string
  /**
   * 模板描述
   */
  description: string
  /**
   * 仓库地址
   */
  registry?: string
  /**
   * 是否为内置信任模板
   */
  trusted?: boolean
}

/**
 * 模版配置项
 */
export interface TemplateConfig {
  /**
   * 应用场景
   */
  scenes: {
    [key: string]: string
  }
  /**
   * 模版集合
   */
  templates: {
    [scene: string]: Record<string, RemoteTemplate>
  }
}

/**
 * 与当前 create-template 版本完成契约测试的官方模版版本
 *
 * @remarks
 * 官方目录使用精确版本，避免已信任模版的 `latest` 在未升级 CLI 时改变可执行代码
 */
const OFFICIAL_TEMPLATE_VERSION = '0.12.2'

/**
 * create-template 内置的官方场景和模版目录
 *
 * @remarks
 * 内置模版会跳过远程代码确认，因此每次升级版本都必须完成主路径契约测试
 */
export const defaultConfig: TemplateConfig = Object.freeze({
  scenes: Object.freeze({
    npm: 'NPM',
  }),
  templates: Object.freeze({
    npm: Object.freeze({
      'template-npm-web': Object.freeze({
        type: 'npm' as const,
        description: 'Web Common Template',
        value: `@eljs/create-plugin-npm-web@${OFFICIAL_TEMPLATE_VERSION}`,
        registry: 'https://registry.npmjs.org/',
        trusted: true,
      }),
      'template-npm-node': Object.freeze({
        type: 'npm' as const,
        description: 'Node Common Template',
        value: `@eljs/create-plugin-npm-node@${OFFICIAL_TEMPLATE_VERSION}`,
        registry: 'https://registry.npmjs.org/',
        trusted: true,
      }),
    }),
  }),
})
