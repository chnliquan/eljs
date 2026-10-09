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
 * 与当前 create-template 版本完成契约测试的官方模板版本
 *
 * @remarks
 * 官方目录使用精确版本，避免已信任模板的 `latest` 在未升级 CLI 时改变可执行代码
 */
const OFFICIAL_TEMPLATE_VERSION = '0.13.0'

/**
 * 待发布回填的 integrity 占位值
 *
 * @remarks
 * 官方模板的 integrity 必须取自真实发布 tarball 的 SHA-512 摘要，无法在包发布前
 * 预先计算。该占位值刻意使用非 base64 字符，使任何真实下载都无法匹配它——一旦
 * templates 仓库发布 0.13.0 的三个包，必须立即替换为各包 registry 元数据中的真实
 * 摘要；未替换前这些条目无法完成下载，且**不得发布**
 */
const PENDING_INTEGRITY = 'sha512-PENDING-PUBLISH'

/**
 * create-template 内置的官方模板目录
 *
 * @remarks
 * 内置模板会跳过远程代码确认，因此每次升级版本都必须完成主路径契约测试。
 * 模板来源的包名携带 templates 仓库的角色前缀（`plugin-` 为插件，`preset-` 为共享预设基座），
 * 预设基座由插件依赖消费，不作为独立入口暴露
 *
 * @internal
 */
export const officialTemplates = Object.freeze({
  'template-npm-package': Object.freeze({
    type: 'npm' as const,
    description: 'NPM Package Template',
    value: `@eljs/create-plugin-npm-package@${OFFICIAL_TEMPLATE_VERSION}`,
    registry: 'https://registry.npmjs.org/',
    integrity: PENDING_INTEGRITY,
    trusted: true,
  }),
  'template-project': Object.freeze({
    type: 'npm' as const,
    description: 'Full-stack Project Template',
    value: `@eljs/create-plugin-project@${OFFICIAL_TEMPLATE_VERSION}`,
    registry: 'https://registry.npmjs.org/',
    integrity: PENDING_INTEGRITY,
    trusted: true,
  }),
} satisfies Record<string, OfficialTemplate>)

/**
 * `create-template` 支持的内置官方模板标识
 */
export type OfficialTemplateName = keyof typeof officialTemplates
