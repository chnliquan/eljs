import type { RemoteTemplate } from '@eljs/create'

/**
 * 内置官方模板的交互展示与远程来源契约
 *
 * @remarks
 * 该类型仅用于包内目录维护，不属于 `@eljs/create-template` 公共 API
 *
 * @internal
 */
export interface OfficialTemplate extends Readonly<RemoteTemplate> {
  /** 交互界面展示的描述 */
  readonly description: string
}

/**
 * create-template 内置的官方模板目录
 *
 * @remarks
 * 内置模板会跳过远程代码确认，且始终拉取 `latest`：模板包由本仓库维护者直接发布，
 * 发布节奏与 `create-template` 的发布节奏解耦，模板更新后无需同步升级并重新发布
 * `create-template` 即可生效。因此这里不固定 `integrity`——固定摘要会锚定某次具体
 * 发布的字节内容，与“始终跟随最新版”互斥，新模板发布后固定摘要会导致下载失败。
 * 模板来源的包名携带 templates 仓库的角色前缀（`plugin-` 为插件，`preset-` 为共享预设基座），
 * 预设基座由插件依赖消费，不作为独立入口暴露
 *
 * @internal
 */
export const officialTemplates = Object.freeze({
  'template-npm-package': Object.freeze({
    type: 'npm' as const,
    description: 'NPM Package Template',
    value: '@eljs/create-plugin-npm-package',
    registry: 'https://registry.npmjs.org/',
    trusted: true,
  }),
  'template-project': Object.freeze({
    type: 'npm' as const,
    description: 'Full-stack Project Template',
    value: '@eljs/create-plugin-project',
    registry: 'https://registry.npmjs.org/',
    trusted: true,
  }),
} satisfies Record<string, OfficialTemplate>)

/**
 * `create-template` 支持的内置官方模板标识
 */
export type OfficialTemplateName = keyof typeof officialTemplates
