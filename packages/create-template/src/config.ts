import { TemplateConfig } from './types'

export const defaultTemplateConfig: TemplateConfig = {
  appType: {
    web: 'Web 应用',
    node: 'Node 应用',
  },
  templates: {
    web: {
      monorepo: {
        type: 'npm',
        description: 'Monorepo Web 通用模版',
        value: '@eljs/template-web-monorepo',
      },
      polyrepo: {
        type: 'npm',
        description: 'Polyrepo Web 通用模版',
        value: '@eljs/template-web-polyrepo',
      },
    },
    node: {
      monorepo: {
        type: 'npm',
        description: 'Monorepo Node 通用模版',
        value: '@eljs/template-node-monorepo',
      },
      polyrepo: {
        type: 'npm',
        description: 'Polyrepo Node 通用模版',
        value: '@eljs/template-node-polyrepo',
      },
    },
  },
}
