# Eljs Monorepo

A comprehensive collection of modern Node.js development tools for building robust applications and automation workflows.

## 🏗 Project Overview

```
eljs/
├── packages/
│   ├── config/                      # Configuration management utilities
│   ├── conventional-changelog-preset/# Custom changelog preset for releases
│   ├── create/                      # Powerful project creation tool
│   ├── create-template/             # Template creation utilities
│   ├── pluggable/                  # Plugin system and architecture
│   ├── release/                    # Automated release management
│   └── utils/                      # Comprehensive Node.js utilities
├── scripts/                        # Build and release automation
├── package.json                    # Root workspace configuration
├── turbo.json                     # Turborepo build pipeline
└── pnpm-workspace.yaml            # pnpm workspace settings
```

## 📋 Available Packages

### 🚀 @eljs/create

Powerful and flexible project creation tool from templates with comprehensive automation support.

```bash
npx @eljs/create my-template my-project
```

**Features**: Dual CLI/API usage, multiple template sources, smart template resolution, interactive mode, plugin system

### 🛠 @eljs/utils

A comprehensive collection of Node.js utilities for modern development workflows.

```bash
pnpm add @eljs/utils
```

**Features**: Cross-platform support, dual async/sync APIs, file operations, git integration, process management, logging

### 📦 @eljs/release

Automated release management with semantic versioning and changelog generation.

```bash
npx @eljs/release
```

**Features**: Semantic versioning, automated changelog generation, multi-package support, git integration

### ⚙️ @eljs/config

Advanced configuration management with schema validation and environment support.

```bash
npm install @eljs/config
```

**Features**: Schema validation, environment variables, configuration merging, TypeScript support

### 🔌 @eljs/pluggable

Extensible plugin system for building modular and customizable applications.

```bash
npm install @eljs/pluggable
```

**Features**: Hook-based architecture, plugin lifecycle management, dependency injection, type safety

## 🔧 Development Guide

### 1. Clone Repository

```bash
git clone https://github.com/chnliquan/eljs.git
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Build All Packages

```bash
pnpm run build
```

### 4. Development Mode

```bash
# Build all packages in watch mode
pnpm run dev

# Build specific package in watch mode
pnpm --filter <package-name> run dev
```

### 5. Run Tests

```bash
# Run tests for all packages
pnpm run test

# Run tests for specific package
pnpm --filter <package-name> run test

# Run tests in watch mode
pnpm run test:w
```

## 🛠 Scripts Reference

| Command                 | Description                   | Usage                       |
| ----------------------- | ----------------------------- | --------------------------- |
| **Development**         |                               |                             |
| `pnpm dev`              | Build packages in watch mode  | `pnpm dev`                  |
| `pnpm build`            | Build all packages            | `pnpm build`                |
| `pnpm test`             | Run all tests                 | `pnpm test`                 |
| `pnpm test:w`           | Run tests in watch mode       | `pnpm test:w`               |
| **Code Quality**        |                               |                             |
| `pnpm lint`             | Lint source code              | `pnpm lint`                 |
| `pnpm format`           | Format code with Prettier     | `pnpm format`               |
| `pnpm coverage`         | Generate test coverage        | `pnpm coverage`             |
| **Release Management**  |                               |                             |
| `pnpm release`          | Release all packages          | `pnpm release`              |
| `pnpm release:patch`    | Patch version release         | `pnpm release:patch`        |
| `pnpm release:minor`    | Minor version release         | `pnpm release:minor`        |
| `pnpm release:major`    | Major version release         | `pnpm release:major`        |
| `pnpm prerelease:alpha` | Prerelease with alpha version | `pnpm prerelease:alpha`     |
| `pnpm prerelease:beta`  | Prerelease with beta version  | `pnpm prerelease:beta`      |
| `pnpm prerelease:next`  | Prerelease with next version  | `pnpm prerelease:next`      |
| **Utilities**           |                               |                             |
| `pnpm gm`               | Interactive git commit        | `pnpm gm`                   |
| `pnpm boot`             | Initialize new package        | `pnpm boot packages/shared` |
| `pnpm add-owner`        | Add npm ownership             | `pnpm add-owner <users>`    |
| `pnpm clean`            | Clean build artifacts         | `pnpm clean`                |

## 📦 Package Management

### Working with Specific Packages

```bash
# Install dependency to specific package
pnpm --filter <package-name> add <dependency>

# Run script in specific package
pnpm --filter <package-name> run <script>

# Build specific package and its dependencies
pnpm --filter <package-name>... run build

# Build packages that depend on specific package
pnpm --filter ...<package-name> run build
```

### Adding New Packages

```bash
# Create new package directory
mkdir packages/<new-package-name>
cd packages/<new-package-name>

# Initialize package structure
pnpm boot

# Or initialize from root
pnpm run boot packages/<new-package-name>
```

## 📋 Version Management

This monorepo uses **unified versioning** - all packages share the same version number and are released together, even if only one package has changes.

### 1. Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/#summary) with package scope:

```bash
# ✅ Correct examples
git commit -m 'feat(create): add template validation'
git commit -m 'fix(utils): resolve path resolution issue'
git commit -m 'docs: update readme'
git commit -m 'chore: update dependencies'

# ❌ Incorrect examples (missing type)
git commit -m 'add some feature'
git commit -m 'fix some bug'

# ❌ Incorrect examples (missing scope for package changes)
git commit -m 'feat: add some feature'
git commit -m 'fix: fix some bug'
```

### 2. Release Process

```bash
# 1. Ensure code is up to date
git pull origin master

# 2. Build packages (optional)
pnpm run build --filter <package-name>
# or build specific package and dependencies
pnpm --filter <package-name>... run build

# 3. Release all packages
pnpm run release

# Available options:
#   --skipTests         Skip unit tests
#   --skipBuild         Skip package build
#   --skipRequireClean  Skip git working tree check
```

### 3. Package Publishing

- Packages marked with `"private": true` in their `package.json` will be skipped during publishing
- All public packages will be published with the same version number
- Version follows [Semantic Versioning](https://semver.org/) specification

## 🌿 Branch Management

This project follows [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/) branching strategy:

<p align="center">
  <img src="https://static.yximgs.com/udata/pkg/ks-ad-fe/chrome-plugin-upload/2022-04-01/1648793291308.92a2b518ac6526d9.png" width="600" alt="Git Flow Branching Model" />
</p>

**Branch Naming Convention:**

- **master**: Main branch, maintains stable releasable state
- **develop**: Development branch, integration branch for features
- **feature/\<package-name\\>-\<feature\>**: Feature branches, branched from develop, merged back to develop when complete (e.g., `feature/create-validation`, `feature/utils-logging`)
- **release/\<version\>**: Release branches, branched from develop, used for release preparation
- **hotfix/\<issue\>**: Hotfix branches, branched from master, used for emergency fixes

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/<package-name>-<feature-name>`
3. Make your changes following the coding standards
4. Add tests for your changes
5. Run tests: `pnpm run test`
6. Commit your changes: `git commit -m 'feat(<package-name>): add some feature'`
7. Push to the branch: `git push origin feature/<package-name>-<feature-name>`
8. Submit a pull request

## 📄 License

[MIT](https://github.com/chnliquan/eljs/blob/master/LICENSE)

---

For questions or suggestions, please submit an [Issue](https://github.chnliquan/eljs/issues) or [Pull Request](https:ub.com/chnliquan/eljs/pulls).
