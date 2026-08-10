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
const OFFICIAL_TEMPLATE_VERSION = '0.12.1'

/**
 * create-template 内置的官方模板目录
 *
 * @remarks
 * 内置模板会跳过远程代码确认，因此每次升级版本都必须完成主路径契约测试
 *
 * @internal
 */
export const officialTemplates: Readonly<Record<string, OfficialTemplate>> =
  Object.freeze({
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
  })
