/* eslint-disable @typescript-eslint/naming-convention */
import { TemplateConfig } from './types'

export const defaultTemplateConfig: TemplateConfig = {
  appType: {
    npm: 'NPM 包',
  },
  templates: {
    npm: {
      'template-npm-web': {
        type: 'npm',
        description: 'Web 通用模版',
        value: '@eljs/create-plugin-npm-web',
      },
      'template-npm-node': {
        type: 'npm',
        description: 'Node 通用模版',
        value: '@eljs/create-plugin-npm-node',
      },
    },
  },
}
