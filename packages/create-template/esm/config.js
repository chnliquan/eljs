/* eslint-disable @typescript-eslint/naming-convention */

export var defaultTemplateConfig = {
  appType: {
    npm: 'NPM 包'
  },
  templates: {
    npm: {
      'template-npm-web': {
        type: 'npm',
        description: 'Web 通用模版',
        value: '@eljs/create-plugin-npm-web',
        registry: 'https://registry.npmjs.org/'
      },
      'template-npm-node': {
        type: 'npm',
        description: 'Node 通用模版',
        value: '@eljs/create-plugin-npm-node',
        registry: 'https://registry.npmjs.org/'
      }
    }
  }
};