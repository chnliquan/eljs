/**
 * 远程模版
 */
export interface RemoteTemplate {
  /**
   * 模版类型
   */
  type: 'npm' | 'git'
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

/* eslint-disable @typescript-eslint/naming-convention */
export const defaultConfig: TemplateConfig = {
  scenes: {
    npm: 'NPM',
  },
  templates: {
    npm: {
      'template-npm-web': {
        type: 'npm',
        description: 'Web Common Template',
        value: '@eljs/create-plugin-npm-web',
        registry: 'https://registry.npmjs.org/',
      },
      'template-npm-node': {
        type: 'npm',
        description: 'Node Common Template',
        value: '@eljs/create-plugin-npm-node',
        registry: 'https://registry.npmjs.org/',
      },
    },
  },
}
