/**
 * 内置目录中的远程模板
 */
export interface RemoteTemplate {
  /** 下载协议 */
  readonly type: 'npm' | 'git'
  /** 包标识或 Git 地址 */
  readonly value: string
  /** 交互界面展示的描述 */
  readonly description: string
  /** npm 模板使用的 registry */
  readonly registry?: string
  /** npm 模板压缩包的 Subresource Integrity 摘要 */
  readonly integrity?: string
  /** 是否由内置目录确认来源可信 */
  readonly trusted?: boolean
}

/**
 * 模版配置项
 */
export interface TemplateConfig {
  /**
   * 应用场景
   */
  readonly scenes: Readonly<Record<string, string>>
  /**
   * 模版集合
   */
  readonly templates: Readonly<
    Record<string, Readonly<Record<string, RemoteTemplate>>>
  >
}

/**
 * 与当前 create-template 版本完成契约测试的官方模版版本
 *
 * @remarks
 * 官方目录使用精确版本，避免已信任模版的 `latest` 在未升级 CLI 时改变可执行代码
 */
const OFFICIAL_TEMPLATE_VERSION = '0.12.1'

/**
 * create-template 内置的官方场景和模版目录
 *
 * @remarks
 * 内置模版会跳过远程代码确认，因此每次升级版本都必须完成主路径契约测试
 */
export const defaultConfig = Object.freeze({
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
        integrity:
          'sha512-PnCXo/ZbnGnQqdFQjG9jI1jXRn9ZV8l4DWE6Txxjmu40PkCF6MRfqCGpCBd4PN2flAKCph+DUaNrKM+6lKrrww==',
        trusted: true,
      }),
      'template-npm-node': Object.freeze({
        type: 'npm' as const,
        description: 'Node Common Template',
        value: `@eljs/create-plugin-npm-node@${OFFICIAL_TEMPLATE_VERSION}`,
        registry: 'https://registry.npmjs.org/',
        integrity:
          'sha512-51zCeHJUTzpp0Gxpnn2LcWAPJOeKi1d9HUF5TIQ2pZDzrdnyuSm5quViki9kMKiYTzwf6HckEvw5I5rD3yQm8A==',
        trusted: true,
      }),
    }),
  }),
}) satisfies TemplateConfig
