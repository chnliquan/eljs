# @eljs/create

Powerful and flexible project creation tool from templates with comprehensive automation support

[![NPM Version](https://img.shields.io/npm/v/@eljs/create.svg)](https://www.npmjs.com/package/@eljs/create)
[![NPM Downloads](https://img.shields.io/npm/dm/@eljs/create.svg)](https://www.npmjs.com/package/@eljs/create)
[![License](https://img.shields.io/npm/l/@eljs/create.svg)](https://github.com/chnliquan/eljs/blob/master/LICENSE)

## ✨ Features

- 🚀 **Dual Usage** - Support both CLI and programmatic API usage
- 📦 **Multiple Template Sources** - Support local, npm, and git templates
- 🎯 **Smart Template Resolution** - Automatic template discovery and resolution
- 💬 **Interactive Mode** - User-friendly prompts for directory conflicts
- 🔧 **Plugin System** - Extensible plugin architecture for custom generators
- 🎨 **Template Customization** - Support for custom generators and configurations
- 🛡️ **Type Safety** - Full TypeScript support with comprehensive type definitions

## 📦 Installation

```bash
# Using pnpm (recommended)
pnpm add @eljs/create -g

# Using yarn
yarn global add @eljs/create

# Using npm
npm install @eljs/create -g
```

## 🚀 Quick Start

### CLI Usage (Recommended)

```bash
# Create from npm template
create my-template my-project

# Create from git repository
create https://github.com/user/template.git my-project

# Create from local template
create ./local-template my-project

# Using npx (no global installation needed)
npx @eljs/create my-template my-project
```

### Programmatic API Usage

```typescript
import { Create, defineConfig } from '@eljs/create'

// Simple project creation
const create = new Create({
  template: 'my-template'
})
await create.run('my-project')

// Create with custom options
const create = new Create({
  template: {
    type: 'npm',
    value: '@company/enterprise-template',
    registry: 'https://npm.company.com'
  },
  force: true,
  cwd: '/workspace'
})
await create.run('enterprise-app')
```

## 📖 CLI Reference

### Commands

```bash
create [options] <template> <project-name>
```

### Arguments

| Argument | Description |
|----------|-------------|
| `template` | Template source (local path, npm package, or git repository) |
| `project-name` | Name of the project to create |

### Template Sources

| Type | Format | Example |
|------|--------|---------|
| **Local Path** | `./path` or `/absolute/path` | `./my-template`, `/usr/templates/react` |
| **NPM Package** | `package-name` or `@scope/package` | `create-react-app`, `@vue/cli-template` |
| **Git Repository** | `https://...` or `git@...` | `https://github.com/user/template.git` |

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-v, --version` | Output the current version | - |
| `--cwd <cwd>` | Specify the working directory | `process.cwd()` |
| `-f, --force` | Overwrite target directory if it exists | `false` |
| `-m, --merge` | Merge with target directory if it exists | `false` |
| `--no-install` | Skip dependency installation after creation | `true` |
| `--no-git-init` | Skip git repository initialization | `true` |
| `-h, --help` | Display help for command | - |

### CLI Examples

```bash
# Basic template creation
create react-template my-react-app

# Force overwrite existing directory
create vue-template my-vue-app --force

# Merge with existing directory
create component-template my-component --merge

# Custom working directory
create api-template my-api --cwd ./projects

# From scoped npm package
create @company/enterprise-template my-enterprise-app

# From git repository with branch
create https://github.com/templates/fullstack.git#main my-fullstack-app

# Local template with custom options
create ./templates/custom-template my-custom-app --no-install --no-git-init
```

## 📖 API Reference

### `Create` Class

Main class for programmatic project creation.

```typescript
class Create {
  constructor(options: CreateOptions)
  async run(projectName: string): Promise<void>
}
```

**Constructor Options:**

```typescript
interface CreateOptions {
  /**
   * Working directory
   * @default process.cwd()
   */
  cwd?: string
  /**
   * Template source
   */
  template: string | RemoteTemplate
  /**
   * Whether to overwrite target directory if it exists
   * @default false
   */
  force?: boolean
  /**
   * Whether to merge with target directory if it exists
   * @default false
   */
  merge?: boolean
}
```

**Remote Template Configuration:**

```typescript
interface RemoteTemplate {
  /**
   * Template type
   */
  type: 'npm' | 'git'
  /**
   * Template source value
   */
  value: string
  /**
   * NPM registry URL (npm type only)
   */
  registry?: string
}
```

### API Examples

```typescript
import { Create } from '@eljs/create'

// Local template
const localCreate = new Create({
  template: './my-local-template',
  cwd: '/workspace',
  merge: true
})
await localCreate.run('local-project')

// NPM template
const npmCreate = new Create({
  template: {
    type: 'npm',
    value: '@scope/template-name',
    registry: 'https://registry.npmjs.org'
  },
  force: true
})
await npmCreate.run('npm-project')

// Git template
const gitCreate = new Create({
  template: {
    type: 'git',
    value: 'https://github.com/user/template.git#main'
  }
})
await gitCreate.run('git-project')
```

## ⚙️ Configuration

Create a **create.config.ts** file in your project root for persistent configuration:

```typescript
import { defineConfig } from '@eljs/create'

export default defineConfig({
  /**
   * Working directory
   * @default process.cwd()
   */
  cwd: process.cwd(),
  
  /**
   * Default template source
   */
  template: '@company/default-template',
  
  /**
   * Directory handling options
   */
  force: false,
  merge: false,
  
  /**
   * Post-creation options
   */
  install: true,
  gitInit: true,
  defaultQuestions: true,
  
  /**
   * Custom presets
   */
  presets: [
    '@company/create-preset'
  ],
  
  /**
   * Custom plugins
   */
  plugins: [
    './plugins/custom-generator.js'
  ]
})
```

## 🔌 Plugin System

Extend creation functionality with custom plugins and generators:

### Custom Generator Plugin

```typescript
// plugins/custom-generator.js
export default {
  name: 'custom-generator',
  async apply(api) {
    // Add custom prompts
    api.addQuestions([
      {
        type: 'input',
        name: 'authorName',
        message: 'What is your name?'
      },
      {
        type: 'select',
        name: 'framework',
        message: 'Choose a framework:',
        choices: ['React', 'Vue', 'Angular']
      }
    ])
    
    // Modify package.json
    api.extendPackage({
      author: api.prompts.authorName,
      keywords: [api.prompts.framework.toLowerCase()]
    })
    
    // Generate files
    api.onGenerateFiles(() => {
      if (api.prompts.framework === 'React') {
        api.copyTpl(
          'templates/react/**',
          api.paths.target,
          api.prompts
        )
      }
    })
  }
}
```

### Template Structure

A complete template should include:

```
my-template/
├── create.config.ts          # Template configuration
├── generators/
│   └── index.ts             # Main generator
├── templates/               # Template files
│   ├── package.json.ejs
│   ├── src/
│   │   └── index.ts.ejs
│   └── README.md.ejs
└── package.json             # Template metadata
```

### Generator Example

```typescript
// generators/index.ts
export default {
  name: 'main-generator',
  async apply(api) {
    // Extend package.json
    api.extendPackage((pkg) => ({
      ...pkg,
      name: api.appData.projectName,
      version: '1.0.0',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        test: 'jest'
      }
    }))
    
    // Copy template files
    api.onGenerateFiles(() => {
      api.copyTpl('templates/**', api.paths.target, {
        ...api.prompts,
        ...api.appData
      })
    })
    
    // Post-generation hooks
    api.onGenerateDone(() => {
      console.log(`✅ Project ${api.appData.projectName} created successfully!`)
    })
  }
}
```

## 📝 Template Development

### Creating a Template

1. **Initialize template structure:**
   ```bash
   mkdir my-template
   cd my-template
   npm init -y
   ```

2. **Add template configuration:**
   ```typescript
   // create.config.ts
   import { defineConfig } from '@eljs/create'
   
   export default defineConfig({
     defaultQuestions: true,
     gitInit: true,
     install: true
   })
   ```

3. **Create generator:**
   ```typescript
   // generators/index.ts
   export default {
     name: 'my-template-generator',
     async apply(api) {
       // Your generator logic here
     }
   }
   ```

4. **Add template files:**
   ```
   templates/
   ├── package.json.ejs
   ├── src/
   │   └── index.ts.ejs
   └── README.md.ejs
   ```

### Template Testing

Test your template locally:

```bash
# Test with local path
create ./my-template test-project

# Test after publishing
npm publish
create my-template test-project
```

## 🏢 Enterprise Usage

### Monorepo Template Management

```typescript
// templates/monorepo/create.config.ts
import { defineConfig } from '@eljs/create'

export default defineConfig({
  presets: [
    '@company/monorepo-preset'
  ],
  plugins: [
    '@company/compliance-plugin',
    '@company/security-plugin'
  ]
})
```

### CI/CD Integration

```yaml
# .github/workflows/create-project.yml
name: Create Project
on:
  workflow_dispatch:
    inputs:
      template:
        description: 'Template to use'
        required: true
        type: choice
        options: ['react-app', 'node-service', 'fullstack']
      project-name:
        description: 'Project name'
        required: true
        type: string

jobs:
  create:
    runs-on: ubuntu-latest
    steps:
      - name: Create Project
        run: |
          npx @eljs/create \
            @company/${{ github.event.inputs.template }}-template \
            ${{ github.event.inputs.project-name }} \
            --force \
            --cwd ./projects
```

### Custom Registry Integration

```typescript
// Enterprise template with private registry
const create = new Create({
  template: {
    type: 'npm',
    value: '@company/enterprise-template',
    registry: 'https://npm.company.com'
  },
  cwd: '/enterprise/workspace',
  force: true
})
await create.run('enterprise-application')
```

## 🔍 Troubleshooting

### Common Issues

**Template not found:**
```bash
# Check if template exists
npm view my-template

# Use full npm package name
create @scope/template-name my-project

# Use git URL for git templates
create https://github.com/user/template.git my-project
```

**Directory already exists:**
```bash
# Force overwrite
create my-template my-project --force

# Merge with existing
create my-template my-project --merge
```

**Permission errors:**
```bash
# Check directory permissions
ls -la /target/directory

# Use different working directory
create my-template my-project --cwd /accessible/directory
```

**Template validation errors:**
```bash
# Ensure template has required files
# Templates must have either:
# - create.config.ts/js OR
# - generators/index.ts/js
```

**Network/registry issues:**
```bash
# Check npm registry
npm config get registry

# Set custom registry
npm config set registry https://registry.npmjs.org

# Clear npm cache
npm cache clean --force
```

### Debug Mode

Enable debug logging:

```bash
DEBUG=create* npx @eljs/create my-template my-project
```

### Template Validation

Validate your template structure:

```bash
# Check template locally
create ./my-template test-validation --cwd /tmp

# Verify template after publishing
npm info my-template
create my-template validation-test
```

## 🌟 Advanced Usage

### Custom Template with Multiple Generators

```typescript
// generators/index.ts
export default [
  {
    name: 'base-generator',
    async apply(api) {
      api.extendPackage({
        name: api.appData.projectName,
        version: '0.1.0'
      })
    }
  },
  {
    name: 'framework-generator',
    async apply(api) {
      api.addQuestions([
        {
          type: 'select',
          name: 'framework',
          message: 'Choose framework:',
          choices: ['React', 'Vue', 'Angular']
        }
      ])
      
      api.onGenerateFiles(() => {
        const framework = api.prompts.framework.toLowerCase()
        api.copyDirectory(
          `templates/${framework}`,
          api.paths.target,
          api.prompts
        )
      })
    }
  }
]
```

### Environment-Specific Templates

```typescript
// Development environment
const devCreate = new Create({
  template: './dev-templates/rapid-prototype',
  merge: true,
  cwd: '/home/developer/workspace'
})

// Production environment  
const prodCreate = new Create({
  template: {
    type: 'npm',
    value: '@company/production-template@stable',
    registry: 'https://npm.company.com'
  },
  force: true,
  cwd: '/opt/production'
})

// CI/CD environment
const ciCreate = new Create({
  template: {
    type: 'git',
    value: 'https://github.com/company/ci-template.git#main'
  },
  force: true,
  cwd: process.env.CI_WORKSPACE
})
```

### Batch Project Creation

```typescript
import { Create } from '@eljs/create'

async function createMultipleProjects() {
  const templates = [
    { template: 'frontend-template', name: 'my-frontend' },
    { template: 'backend-template', name: 'my-backend' },
    { template: 'shared-template', name: 'my-shared' }
  ]
  
  for (const { template, name } of templates) {
    const create = new Create({
      template,
      cwd: './monorepo/packages',
      force: true
    })
    
    await create.run(name)
    console.log(`✅ Created ${name} from ${template}`)
  }
}

createMultipleProjects()
```

## 📋 Template Development Guide

### 1. Template Structure Best Practices

```
recommended-template/
├── package.json              # Template metadata
├── create.config.ts          # Template configuration  
├── generators/
│   ├── index.ts             # Main generator
│   ├── app.ts               # App-specific generator
│   └── testing.ts           # Testing setup generator
├── templates/               # Template files
│   ├── base/                # Base files for all variants
│   │   ├── package.json.ejs
│   │   ├── tsconfig.json.ejs  
│   │   └── .gitignore
│   ├── react/               # React-specific files
│   │   └── src/
│   │       └── App.tsx.ejs
│   └── vue/                 # Vue-specific files
│       └── src/
│           └── App.vue.ejs
├── docs/                    # Template documentation
│   └── README.md
└── tests/                   # Template tests
    └── template.test.js
```

### 2. Template Configuration Options

```typescript
// create.config.ts
import { defineConfig } from '@eljs/create'

export default defineConfig({
  // Basic settings
  defaultQuestions: true,
  gitInit: true,
  install: true,
  
  // Custom metadata
  metadata: {
    name: 'My Awesome Template',
    description: 'A comprehensive project template',
    version: '2.1.0',
    author: 'Template Author',
    tags: ['react', 'typescript', 'tailwindcss']
  },
  
  // Custom presets
  presets: [
    '@company/base-preset',
    './presets/custom-preset.js'
  ],
  
  // Plugin configuration
  plugins: [
    '@company/eslint-plugin',
    '@company/prettier-plugin',
    {
      name: 'custom-inline-plugin',
      apply(api) {
        // Inline plugin logic
      }
    }
  ]
})
```

### 3. Generator API Reference

```typescript
// generators/index.ts
export default {
  name: 'comprehensive-generator',
  async apply(api) {
    // 1. Add interactive prompts
    api.addQuestions([
      {
        type: 'input',
        name: 'description',
        message: 'Project description:',
        default: 'An awesome project'
      },
      {
        type: 'multiselect',
        name: 'features',
        message: 'Select features:',
        choices: ['TypeScript', 'ESLint', 'Prettier', 'Jest', 'Husky']
      }
    ])
    
    // 2. Modify package.json
    api.extendPackage((pkg) => ({
      ...pkg,
      name: api.appData.projectName,
      description: api.prompts.description,
      keywords: api.prompts.features.map(f => f.toLowerCase()),
      scripts: {
        dev: 'vite dev',
        build: 'vite build',
        test: api.prompts.features.includes('Jest') ? 'jest' : undefined
      }
    }))
    
    // 3. Generate files based on selections
    api.onGenerateFiles(() => {
      // Base files
      api.copyTpl('templates/base/**', api.paths.target, api.prompts)
      
      // Conditional files based on features
      if (api.prompts.features.includes('TypeScript')) {
        api.copyFile('templates/tsconfig.json', 'tsconfig.json')
      }
      
      if (api.prompts.features.includes('ESLint')) {
        api.copyTpl('templates/eslint/**', api.paths.target, api.prompts)
      }
    })
    
    // 4. Post-generation tasks
    api.onGenerateDone(() => {
      api.logger.success(`🎉 ${api.appData.projectName} created successfully!`)
      api.logger.info(`📁 Location: ${api.paths.target}`)
      
      if (api.prompts.features.includes('Jest')) {
        api.install(['jest', '@types/jest'], { dev: true })
      }
    })
  }
}
```

## 🏗️ Built-in Generators

### Available Generator Methods

| Method | Description | Example |
|--------|-------------|---------|
| `api.copyFile(from, to)` | Copy single file | `api.copyFile('template.txt', 'output.txt')` |
| `api.copyTpl(from, to, data)` | Copy template with data | `api.copyTpl('src/**', target, prompts)` |
| `api.copyDirectory(from, to, data)` | Copy entire directory | `api.copyDirectory('templates', target)` |
| `api.render(template, data)` | Render template string | `api.render('Hello {{name}}', {name: 'World'})` |
| `api.extendPackage(extension)` | Extend package.json | `api.extendPackage({scripts: {test: 'jest'}})` |
| `api.install(deps, options)` | Install dependencies | `api.install(['react', 'react-dom'])` |

## 🌍 Community Templates

### Popular Templates

| Template | Description | Usage |
|----------|-------------|-------|
| `@eljs/react-template` | Modern React + TypeScript + Vite | `create @eljs/react-template my-react-app` |
| `@eljs/node-template` | Node.js + TypeScript + Express | `create @eljs/node-template my-api` |
| `@eljs/library-template` | TypeScript library with bundling | `create @eljs/library-template my-lib` |
| `@eljs/cli-template` | CLI tool with Commander.js | `create @eljs/cli-template my-cli` |

### Template Registry

Browse available templates:

```bash
# Search templates
npm search @eljs/template

# Get template info
npm info @eljs/react-template

# List all @eljs templates
npm search @eljs/template --json | jq '.[].name'
```

## 📊 Performance Tips

### Optimization Strategies

1. **Use Local Templates for Development:**
   ```bash
   create ./local-template test-project  # Faster than downloading
   ```

2. **Cache Template Downloads:**
   ```typescript
   // Templates are automatically cached in system temp directory
   // Subsequent uses of same template version are instant
   ```

3. **Minimize Template Size:**
   ```json
   // package.json - exclude unnecessary files
   {
     "files": ["generators", "templates", "create.config.js"],
     "devDependencies": {
       // Move build tools to devDependencies
     }
   }
   ```

## 🔒 Security Considerations

### Template Validation

- **✅ Source Verification** - Verify template sources before usage
- **✅ Dependency Scanning** - Scan template dependencies for vulnerabilities  
- **✅ Code Review** - Review template code before deployment
- **✅ Registry Trust** - Use trusted npm registries

### Safe Practices

```typescript
// Use specific versions for production
const create = new Create({
  template: {
    type: 'npm',
    value: '@trusted/template@1.2.3', // Pinned version
    registry: 'https://trusted-registry.com'
  }
})

// Validate before running
if (await validateTemplate(create.template)) {
  await create.run('safe-project')
}
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone repository
git clone https://github.com/chnliquan/eljs.git
cd eljs

# Install dependencies
pnpm install

# Run tests
pnpm test packages/create

# Build package
pnpm build packages/create
```

### Creating Templates

Want to create public templates? Follow our [Template Creation Guide](./docs/template-creation.md).

## 📄 License

[MIT](https://github.com/chnliquan/eljs/blob/master/LICENSE)

---

## 📚 Related Packages

- [`@eljs/release`](../release) - Package release automation
- [`@eljs/utils`](../utils) - Shared utilities
- [`@eljs/pluggable`](../pluggable) - Plugin system foundation

## 🙏 Acknowledgments

Special thanks to all contributors and the open source community for making this project possible.

---

<div align="center">
  <sub>Built with ❤️ by the <a href="https://github.com/chnliquan/eljs">ELJS Team</a></sub>
</div>
